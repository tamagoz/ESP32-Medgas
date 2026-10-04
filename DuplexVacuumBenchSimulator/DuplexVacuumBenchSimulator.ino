/*
  ตัวจำลองตู้ปั๊มสุญญากาศคู่สำหรับ bench test เท่านั้น

  ข้อจำกัดสำคัญ:
  - โค้ดนี้จำลองตรรกะผ่าน Serial เท่านั้น ไม่ใช่ firmware ควบคุมเครื่องจริง
  - ไม่มี pinMode(), digitalWrite(), analogRead(), Wi-Fi หรือคำสั่งควบคุมโหลด
  - ห้ามต่อ GPIO ไปยังรีเลย์ คอนแทคเตอร์ เซนเซอร์ หรือวงจรไฟฟ้าใด ๆ
  - Setpoint และ lag delay เป็นค่าอ้างอิงจากเอกสารที่ยังไม่ได้รับรอง
*/

#include <Arduino.h>

// ค่าด้านล่างใช้เพื่อสาธิตบน simulator เท่านั้น ไม่ใช่ค่าที่อนุมัติหน้างาน
constexpr float CUT_IN_INHG = -15.0f;
constexpr float CUT_OUT_INHG = -20.0f;
constexpr float VACUUM_MIN_INHG = -30.0f;
constexpr float VACUUM_MAX_INHG = 0.0f;
constexpr uint32_t LAG_DELAY_SECONDS = 180;

enum class RunMode : uint8_t {
  Auto,
  Off
};

enum class SimState : uint8_t {
  Idle,
  LeadRun,
  LagAssist,
  SensorFault,
  FaultLock,
  Off
};

struct SimPump {
  bool running;
  bool available;
  bool tripped;
  uint32_t startCount;
};

SimPump pumps[2] = {
  {false, true, false, 0},
  {false, true, false, 0}
};

RunMode mode = RunMode::Auto;
SimState state = SimState::Idle;
float simulatedVacuumInHg = -20.0f;
uint32_t simulatedSeconds = 0;
uint32_t demandStartedAt = 0;
uint8_t leadPump = 0;
bool demandActive = false;
bool sensorHealthy = true;
bool cycleNeedsAlternation = false;

String inputLine;

const char* stateName(SimState value) {
  switch (value) {
    case SimState::Idle: return "IDLE";
    case SimState::LeadRun: return "LEAD_RUN";
    case SimState::LagAssist: return "LAG_ASSIST";
    case SimState::SensorFault: return "SENSOR_FAULT";
    case SimState::FaultLock: return "FAULT_LOCK";
    case SimState::Off: return "OFF";
  }
  return "UNKNOWN";
}

const char* modeName(RunMode value) {
  return value == RunMode::Auto ? "AUTO" : "OFF";
}

void stopSimulatedPumps() {
  pumps[0].running = false;
  pumps[1].running = false;
}

void startSimulatedPump(uint8_t index) {
  if (index > 1 || !pumps[index].available || pumps[index].running) {
    return;
  }
  pumps[index].running = true;
  pumps[index].startCount++;
  Serial.printf("[SIM] Pump %u -> RUN (สถานะจำลองเท่านั้น)\n", index + 1);
}

void printStatus() {
  Serial.println();
  Serial.println(F("=== DUPLEX VACUUM BENCH SIMULATOR ==="));
  Serial.printf("เวลาจำลอง: %lu s\n", static_cast<unsigned long>(simulatedSeconds));
  Serial.printf("Vacuum จำลอง: %.2f inHg | Sensor: %s\n",
                simulatedVacuumInHg, sensorHealthy ? "OK" : "FAIL");
  Serial.printf("Mode: %s | State: %s | Lead ถัดไป: Pump %u\n",
                modeName(mode), stateName(state), leadPump + 1);
  Serial.printf("Pump 1: %s, %s, starts=%lu\n",
                pumps[0].running ? "RUN" : "STOP",
                pumps[0].available ? "AVAILABLE" : "TRIPPED",
                static_cast<unsigned long>(pumps[0].startCount));
  Serial.printf("Pump 2: %s, %s, starts=%lu\n",
                pumps[1].running ? "RUN" : "STOP",
                pumps[1].available ? "AVAILABLE" : "TRIPPED",
                static_cast<unsigned long>(pumps[1].startCount));
  Serial.printf("Cut-in=%.1f, Cut-out=%.1f inHg, Lag=%lu s (ค่าอ้างอิงจำลอง)\n",
                CUT_IN_INHG, CUT_OUT_INHG,
                static_cast<unsigned long>(LAG_DELAY_SECONDS));
  Serial.println(F("ไม่มีการอ่าน/สั่ง GPIO และไม่มีโหลดจริง"));
  Serial.println();
}

void printHelp() {
  Serial.println();
  Serial.println(F("คำสั่ง (พิมพ์แล้วกด Enter):"));
  Serial.println(F("  help                 แสดงรายการคำสั่ง"));
  Serial.println(F("  status               แสดงสถานะจำลอง"));
  Serial.println(F("  set <inHg>           ป้อนค่า vacuum จำลอง เช่น set -14.8"));
  Serial.println(F("  advance <seconds>    เดินเวลาจำลอง เช่น advance 180"));
  Serial.println(F("  trip <1|2>           จำลอง overload ของปั๊ม"));
  Serial.println(F("  cleartrip <1|2>      คืนปั๊มจำลองหลังตรวจสอบ"));
  Serial.println(F("  sensor <ok|fail>     จำลองสถานะข้อมูลเซนเซอร์"));
  Serial.println(F("  reset                reset fault lock ใน simulator"));
  Serial.println(F("  mode <auto|off>      เปลี่ยนโหมดจำลอง"));
  Serial.println(F("ตัวเลข/สถานะทั้งหมดเป็นข้อมูลจำลอง ไม่ส่งผลต่ออุปกรณ์จริง."));
  Serial.println();
}

void evaluateSimulation() {
  if (mode == RunMode::Off) {
    stopSimulatedPumps();
    demandActive = false;
    state = SimState::Off;
    return;
  }

  if (!sensorHealthy) {
    stopSimulatedPumps();
    demandActive = false;
    state = SimState::SensorFault;
    return;
  }

  if (state == SimState::FaultLock) {
    stopSimulatedPumps();
    return;
  }

  if (simulatedVacuumInHg <= CUT_OUT_INHG) {
    if (demandActive) {
      stopSimulatedPumps();
      demandActive = false;
      cycleNeedsAlternation = true;
    }
    if (cycleNeedsAlternation) {
      const uint8_t nextLead = 1 - leadPump;
      if (pumps[nextLead].available) {
        leadPump = nextLead;
      }
      cycleNeedsAlternation = false;
      Serial.printf("[SIM] Cut-out reached; next lead is Pump %u\n", leadPump + 1);
    }
    state = SimState::Idle;
    return;
  }

  if (!demandActive && simulatedVacuumInHg > CUT_IN_INHG) {
    demandActive = true;
    demandStartedAt = simulatedSeconds;
    if (!pumps[leadPump].available) {
      leadPump = 1 - leadPump;
    }
    if (!pumps[leadPump].available) {
      state = SimState::FaultLock;
      stopSimulatedPumps();
      Serial.println(F("[SIM] ไม่มีปั๊มจำลองพร้อมใช้งาน -> FAULT_LOCK"));
      return;
    }
    startSimulatedPump(leadPump);
  }

  if (demandActive && simulatedVacuumInHg > CUT_OUT_INHG &&
      simulatedSeconds - demandStartedAt >= LAG_DELAY_SECONDS) {
    const uint8_t lagPump = 1 - leadPump;
    if (pumps[lagPump].available) {
      startSimulatedPump(lagPump);
    }
  }

  if (pumps[0].running && pumps[1].running) {
    state = SimState::LagAssist;
  } else if (pumps[0].running || pumps[1].running) {
    state = SimState::LeadRun;
  } else {
    state = SimState::Idle;
  }
}

bool parseFloatValue(const String& text, float& value) {
  char* end = nullptr;
  value = strtof(text.c_str(), &end);
  return end != text.c_str() && *end == '\0' && isfinite(value);
}

bool parseUnsignedValue(const String& text, uint32_t& value) {
  if (text.isEmpty()) {
    return false;
  }
  for (size_t i = 0; i < text.length(); ++i) {
    if (!isDigit(text[i])) {
      return false;
    }
  }
  const unsigned long parsed = strtoul(text.c_str(), nullptr, 10);
  if (parsed > 86400UL) {
    return false;
  }
  value = static_cast<uint32_t>(parsed);
  return true;
}

bool parsePumpIndex(const String& text, uint8_t& index) {
  if (text == "1") {
    index = 0;
    return true;
  }
  if (text == "2") {
    index = 1;
    return true;
  }
  return false;
}

void handleCommand(String command) {
  command.trim();
  if (command.isEmpty()) {
    return;
  }

  const int separator = command.indexOf(' ');
  String verb = separator < 0 ? command : command.substring(0, separator);
  String argument = separator < 0 ? "" : command.substring(separator + 1);
  verb.toLowerCase();
  argument.trim();

  if (verb == "help") {
    printHelp();
  } else if (verb == "status") {
    printStatus();
  } else if (verb == "set") {
    float value = 0.0f;
    if (!parseFloatValue(argument, value) ||
        value < VACUUM_MIN_INHG || value > VACUUM_MAX_INHG) {
      Serial.println(F("ปฏิเสธ: ระบุค่าเป็นตัวเลขในช่วง -30.0 ถึง 0.0 inHg"));
      return;
    }
    simulatedVacuumInHg = value;
    Serial.printf("[SIM] ตั้ง vacuum เป็น %.2f inHg\n", simulatedVacuumInHg);
    evaluateSimulation();
    printStatus();
  } else if (verb == "advance") {
    uint32_t seconds = 0;
    if (!parseUnsignedValue(argument, seconds)) {
      Serial.println(F("ปฏิเสธ: advance ต้องเป็นจำนวนเต็ม 0 ถึง 86400"));
      return;
    }
    for (uint32_t i = 0; i < seconds; ++i) {
      simulatedSeconds++;
      evaluateSimulation();
    }
    Serial.printf("[SIM] เดินเวลาไปข้างหน้า %lu วินาที\n",
                  static_cast<unsigned long>(seconds));
    printStatus();
  } else if (verb == "trip" || verb == "cleartrip") {
    uint8_t index = 0;
    if (!parsePumpIndex(argument, index)) {
      Serial.println(F("รูปแบบ: trip 1|2 หรือ cleartrip 1|2"));
      return;
    }
    if (verb == "trip") {
      pumps[index].tripped = true;
      pumps[index].available = false;
      pumps[index].running = false;
      Serial.printf("[SIM] จำลอง OL trip ของ Pump %u\n", index + 1);
      if (!pumps[0].available && !pumps[1].available) {
        demandActive = false;
        stopSimulatedPumps();
        state = SimState::FaultLock;
        Serial.println(F("[SIM] ทั้งสองปั๊มจำลอง trip -> FAULT_LOCK"));
      } else {
        // สาธิตการโอนงานในซอฟต์แวร์ทันที; ไม่ใช่การกำหนดเวลาหรือข้อกำหนดระบบจริง
        if (demandActive && !pumps[0].running && !pumps[1].running) {
          leadPump = 1 - index;
          demandStartedAt = simulatedSeconds;
          startSimulatedPump(leadPump);
          Serial.printf("[SIM] โอน lead ไป Pump %u (จำลอง)\n", leadPump + 1);
        }
        evaluateSimulation();
      }
      printStatus();
    } else {
      pumps[index].tripped = false;
      pumps[index].available = true;
      Serial.printf("[SIM] คืน Pump %u ให้พร้อมใช้งานใน simulator\n", index + 1);
      printStatus();
    }
  } else if (verb == "sensor") {
    argument.toLowerCase();
    if (argument == "fail") {
      sensorHealthy = false;
    } else if (argument == "ok") {
      sensorHealthy = true;
    } else {
      Serial.println(F("รูปแบบ: sensor ok|fail"));
      return;
    }
    evaluateSimulation();
    printStatus();
  } else if (verb == "reset") {
    if (!sensorHealthy || (!pumps[0].available && !pumps[1].available)) {
      Serial.println(F("Reset ไม่สำเร็จ: ต้องให้ sensor OK และมีปั๊มจำลองพร้อมอย่างน้อยหนึ่งตัว"));
      return;
    }
    state = SimState::Idle;
    demandActive = false;
    stopSimulatedPumps();
    Serial.println(F("[SIM] ล้าง fault lock จำลองแล้ว; ไม่มีผลกับอุปกรณ์จริง"));
    evaluateSimulation();
    printStatus();
  } else if (verb == "mode") {
    argument.toLowerCase();
    if (argument == "off") {
      mode = RunMode::Off;
    } else if (argument == "auto") {
      mode = RunMode::Auto;
    } else {
      Serial.println(F("รูปแบบ: mode auto|off"));
      return;
    }
    evaluateSimulation();
    printStatus();
  } else {
    Serial.println(F("ไม่รู้จักคำสั่ง; พิมพ์ help"));
  }
}

void setup() {
  // เริ่มเฉพาะ Serial; จงใจไม่กำหนดหรือสั่งขา GPIO ใด ๆ
  Serial.begin(115200);
  inputLine.reserve(96);
  Serial.println();
  Serial.println(F("DUPLEX VACUUM PUMP — SOFTWARE-ONLY BENCH SIMULATOR"));
  Serial.println(F("ไม่ใช่ตัวควบคุมจริง; ห้ามต่อ GPIO/รีเลย์/โหลด"));
  Serial.printf("ค่าอ้างอิงจำลอง: cut-in %.1f, cut-out %.1f inHg, lag %lu s\n",
                CUT_IN_INHG, CUT_OUT_INHG,
                static_cast<unsigned long>(LAG_DELAY_SECONDS));
  printHelp();
  evaluateSimulation();
}

void loop() {
  while (Serial.available() > 0) {
    const char character = static_cast<char>(Serial.read());
    if (character == '\n' || character == '\r') {
      if (!inputLine.isEmpty()) {
        handleCommand(inputLine);
        inputLine = "";
      }
    } else if (inputLine.length() < 95) {
      inputLine += character;
    } else {
      inputLine = "";
      Serial.println(F("บรรทัดคำสั่งยาวเกินไป; ยกเลิกคำสั่ง"));
    }
  }
}

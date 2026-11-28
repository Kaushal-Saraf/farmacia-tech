/*
  Farmacia Tech: pairing screen on a 128x64 OLED (SSD1306, I2C), driven by an Arduino.

  The Raspberry Pi does everything else (network, QR). It sends the QR and the text over USB
  serial and this sketch only draws them:

      +----------------+----------------+
      |  ##  # ## ###  | Scan to        |
      |  # ##  ## # #  | link           |
      |  ## QR CODE #  | FT-MC-         |
      |  # ## ### ##   | 4HT8PW         |
      |  ### # ## # #  | K7QM-3XHP      |
      |  # ### # ###   | 9:58           |
      +----------------+----------------+
        left 64x64: QR, 2 pixels per square    right: Device ID, code, time left

  Libraries (Arduino IDE -> Library Manager): "Adafruit SSD1306" and "Adafruit GFX".
  Wiring (Uno/Nano): OLED SDA -> A4, SCL -> A5, VCC -> 5V (or 3.3V), GND -> GND.

  Serial at 115200 baud, one command per line. Every command is answered with "OK" (or "ERR ...").
    PAIR <size>                    start a pairing screen; size = number of QR rows (29)
    Q <row> <bits>                 one QR row, top row = 0. '1' = dark square, '0' = light
    SHOW <deviceId> <code> <secs>  draw the text, show the screen, count down <secs>
    DONE <word>                    end: e.g. "DONE Linked" or "DONE Expired"
    CLEAR                          blank the screen
  The Pi side is send_lines(ser, client.pair_screen_lines(p)) in ft_device_client.py.

  Already have a sketch for the buttons and other screens? Copy handleLine() and the draw
  functions into it, and call readSerial() and tickCountdown() from your loop().
*/
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

const uint8_t OLED_ADDRESS = 0x3C;  // most 0.96" boards; some use 0x3D
Adafruit_SSD1306 oled(128, 64, &Wire, -1);

const uint8_t QR_BOX = 64;  // the QR lives in the left 64x64 square
const uint8_t TEXT_X = 68;  // text starts here: 60 pixels = 10 characters
uint8_t qrSize = 0, qrScale = 2, qrOffset = 3;

char line[72];
uint8_t lineLength = 0;
bool lineTooLong = false;

long secondsLeft = -1;  // -1: no countdown running
unsigned long lastTick = 0;

// Declared up front so the sketch also builds outside the Arduino IDE (e.g. PlatformIO).
void readSerial();
void handleLine(char *text);
void tickCountdown();
void drawPairText(const char *deviceId, const char *code);
void drawCountdown();
void showMessage(const char *title, const char *detail);

void setup() {
  Serial.begin(115200);
  if (!oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    for (;;) {}  // screen not found: check the wiring and OLED_ADDRESS
  }
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(1);
  showMessage("Farmacia Tech", "Ready");
}

void loop() {
  readSerial();
  tickCountdown();
}

// ---- serial -------------------------------------------------------------------------------
void readSerial() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      line[lineLength] = '\0';
      if (lineTooLong) Serial.println(F("ERR line too long"));
      else if (lineLength) handleLine(line);
      lineLength = 0;
      lineTooLong = false;
    } else if (lineLength < sizeof(line) - 1) {
      line[lineLength++] = c;
    } else {
      lineTooLong = true;
    }
  }
}

void handleLine(char *text) {
  char *command = strtok(text, " ");
  if (!command) return;

  if (strcmp(command, "PAIR") == 0) {
    char *size = strtok(NULL, " ");
    int n = size ? atoi(size) : 0;
    if (n < 21 || n > QR_BOX - 2) { Serial.println(F("ERR size")); return; }
    qrSize = n;
    qrScale = QR_BOX / (n + 2);                // leave at least one light square around it
    qrOffset = (QR_BOX - n * qrScale) / 2;
    secondsLeft = -1;
    oled.clearDisplay();
    oled.fillRect(0, 0, QR_BOX, QR_BOX, SSD1306_WHITE);  // light background, dark squares
  } else if (strcmp(command, "Q") == 0) {
    char *row = strtok(NULL, " ");
    char *bits = strtok(NULL, " ");
    int y = row ? atoi(row) : -1;
    if (!bits || y < 0 || y >= qrSize || strlen(bits) != qrSize) { Serial.println(F("ERR row")); return; }
    for (uint8_t x = 0; x < qrSize; x++) {
      if (bits[x] == '1') oled.fillRect(qrOffset + x * qrScale, qrOffset + y * qrScale, qrScale, qrScale, SSD1306_BLACK);
    }
  } else if (strcmp(command, "SHOW") == 0) {
    char *deviceId = strtok(NULL, " ");
    char *code = strtok(NULL, " ");
    char *secs = strtok(NULL, " ");
    if (!deviceId || !code || !secs) { Serial.println(F("ERR show")); return; }
    drawPairText(deviceId, code);
    secondsLeft = atol(secs);
    lastTick = millis();
    drawCountdown();  // also sends the screen to the OLED
  } else if (strcmp(command, "DONE") == 0) {
    char *word = strtok(NULL, " ");
    secondsLeft = -1;
    if (word && strcmp(word, "Linked") == 0) showMessage("Linked", "You can use it now");
    else showMessage("Code expired", "Press Pair again");
  } else if (strcmp(command, "CLEAR") == 0) {
    secondsLeft = -1;
    oled.clearDisplay();
    oled.display();
  } else {
    Serial.println(F("ERR unknown"));
    return;
  }
  Serial.println(F("OK"));
}

// ---- drawing --------------------------------------------------------------------------------
void drawPairText(const char *deviceId, const char *code) {
  oled.fillRect(TEXT_X, 0, 128 - TEXT_X, 64, SSD1306_BLACK);
  oled.setCursor(TEXT_X, 0);
  oled.print(F("Scan to"));
  oled.setCursor(TEXT_X, 9);
  oled.print(F("link"));

  // Device ID on two lines if it is longer than 10 characters, split after a dash ("FT-MC-" / "4HT8PW").
  size_t n = strlen(deviceId);
  size_t split = n;
  if (n > 10) {
    split = 10;
    for (size_t i = 10; i > 0; i--) {
      if (deviceId[i - 1] == '-') { split = i; break; }
    }
  }
  oled.setCursor(TEXT_X, 22);
  for (size_t i = 0; i < split; i++) oled.print(deviceId[i]);
  oled.setCursor(TEXT_X, 31);
  for (size_t i = split; i < n && i < split + 10; i++) oled.print(deviceId[i]);

  oled.setCursor(TEXT_X, 44);
  oled.print(code);
}

void drawCountdown() {
  oled.fillRect(TEXT_X, 56, 128 - TEXT_X, 8, SSD1306_BLACK);
  oled.setCursor(TEXT_X, 56);
  oled.print(secondsLeft / 60);
  oled.print(':');
  if (secondsLeft % 60 < 10) oled.print('0');
  oled.print(secondsLeft % 60);
  oled.display();
}

void tickCountdown() {
  if (secondsLeft < 0 || millis() - lastTick < 1000) return;
  lastTick += 1000;
  secondsLeft--;
  if (secondsLeft <= 0) {
    secondsLeft = -1;
    showMessage("Code expired", "Press Pair again");
  } else {
    drawCountdown();
  }
}

void showMessage(const char *title, const char *detail) {
  oled.clearDisplay();
  oled.setTextSize(strlen(title) <= 10 ? 2 : 1);  // big letters are 12 pixels wide: 10 fit on the screen
  oled.setCursor(0, 10);
  oled.print(title);
  oled.setTextSize(1);
  oled.setCursor(0, 40);
  oled.print(detail);
  oled.display();
}

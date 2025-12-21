using System;
using System.Runtime.InteropServices;

class Program {
    // XInput constants
    const uint XUSER_MAX_COUNT = 4;
    const uint ERROR_SUCCESS = 0;
    const int XINPUT_GAMEPAD_LEFT_THUMB_DEADZONE = 7849;
    const int XINPUT_GAMEPAD_RIGHT_THUMB_DEADZONE = 8689;
    const int XINPUT_GAMEPAD_TRIGGER_THRESHOLD = 30;

    [StructLayout(LayoutKind.Sequential)]
    struct XINPUT_GAMEPAD {
        public ushort wButtons;
        public byte bLeftTrigger;
        public byte bRightTrigger;
        public short sThumbLX;
        public short sThumbLY;
        public short sThumbRX;
        public short sThumbRY;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct XINPUT_STATE {
        public uint dwPacketNumber;
        public XINPUT_GAMEPAD Gamepad;
    }

    // Try xinput1_4.dll first (Windows 8+), fallback to xinput9_1_0.dll (Windows Vista/7)
    [DllImport("xinput1_4.dll", EntryPoint = "XInputGetState")]
    static extern uint XInputGetState14(uint dwUserIndex, ref XINPUT_STATE pState);

    [DllImport("xinput9_1_0.dll", EntryPoint = "XInputGetState")]
    static extern uint XInputGetState910(uint dwUserIndex, ref XINPUT_STATE pState);

    static uint[] lastPacketNumbers = new uint[XUSER_MAX_COUNT];
    static bool useXInput14 = true;

    static uint GetState(uint index, ref XINPUT_STATE state) {
        try {
            if (useXInput14) {
                return XInputGetState14(index, ref state);
            }
        } catch (DllNotFoundException) {
            useXInput14 = false;
        }
        return XInputGetState910(index, ref state);
    }

    static bool HasActivity(ref XINPUT_GAMEPAD gamepad) {
        // Check buttons
        if (gamepad.wButtons != 0) return true;

        // Check triggers
        if (gamepad.bLeftTrigger > XINPUT_GAMEPAD_TRIGGER_THRESHOLD) return true;
        if (gamepad.bRightTrigger > XINPUT_GAMEPAD_TRIGGER_THRESHOLD) return true;

        // Check left stick (with deadzone)
        double leftMagnitude = Math.Sqrt(gamepad.sThumbLX * gamepad.sThumbLX + gamepad.sThumbLY * gamepad.sThumbLY);
        if (leftMagnitude > XINPUT_GAMEPAD_LEFT_THUMB_DEADZONE) return true;

        // Check right stick (with deadzone)
        double rightMagnitude = Math.Sqrt(gamepad.sThumbRX * gamepad.sThumbRX + gamepad.sThumbRY * gamepad.sThumbRY);
        if (rightMagnitude > XINPUT_GAMEPAD_RIGHT_THUMB_DEADZONE) return true;

        return false;
    }

    static void Main() {
        string line;

        // Continuous loop reading from STDIN
        while ((line = Console.ReadLine()) != null) {
            bool anyActivity = false;
            bool anyConnected = false;

            // Check all 4 possible controllers
            for (uint i = 0; i < XUSER_MAX_COUNT; i++) {
                XINPUT_STATE state = new XINPUT_STATE();
                uint result = GetState(i, ref state);

                if (result == ERROR_SUCCESS) {
                    anyConnected = true;

                    // Check if there's any input activity
                    if (HasActivity(ref state.Gamepad)) {
                        anyActivity = true;
                        break;
                    }

                    // Also check if packet number changed (indicates any state change)
                    if (state.dwPacketNumber != lastPacketNumbers[i]) {
                        lastPacketNumbers[i] = state.dwPacketNumber;
                        // Packet changed but no activity detected means controller state reset
                    }
                }
            }

            // Output: "connected,active" (e.g., "true,true" or "true,false" or "false,false")
            Console.WriteLine("{0},{1}", anyConnected.ToString().ToLower(), anyActivity.ToString().ToLower());
        }
    }
}

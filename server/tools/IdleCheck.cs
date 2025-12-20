using System;
using System.Runtime.InteropServices;
using System.IO;

class Program {
    [DllImport("User32.dll")]
    private static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

    [StructLayout(LayoutKind.Sequential)]
    private struct LASTINPUTINFO {
        public uint cbSize;
        public uint dwTime;
    }

    static void Main() {
        string line;
        LASTINPUTINFO lii = new LASTINPUTINFO();
        lii.cbSize = (uint)Marshal.SizeOf(lii);

        // Continuous loop reading from STDIN
        while ((line = Console.ReadLine()) != null) {
            // We just expect any input (like "check") to trigger a response
            if (GetLastInputInfo(ref lii)) {
                uint tickCount = (uint)Environment.TickCount;
                uint idleTicks = tickCount - lii.dwTime;
                Console.WriteLine(idleTicks / 1000);
            } else {
                Console.WriteLine("0");
            }
        }
    }
}

# AudioCheck.ps1 - Check if any application is currently outputting audio
# Uses Windows Core Audio API

Add-Type @"
using System;
using System.Runtime.InteropServices;

public class AudioDetector {
    [DllImport("ole32.dll")]
    private static extern int CoCreateInstance(ref Guid clsid, IntPtr pUnkOuter, uint dwClsContext, ref Guid iid, out IAudioMeterInformation ppv);

    [Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioMeterInformation {
        int GetPeakValue(out float pfPeak);
    }

    [DllImport("ole32.dll")]
    private static extern int CoInitializeEx(IntPtr pvReserved, uint dwCoInit);

    private static readonly Guid CLSID_MMDeviceEnumerator = new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E");
    private static readonly Guid IID_IMMDeviceEnumerator = new Guid("A95664D2-9614-4F35-A746-DE8DB63617E6");
    private static readonly Guid IID_IAudioMeterInformation = new Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064");

    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDeviceEnumerator {
        int EnumAudioEndpoints(int dataFlow, int dwStateMask, out IntPtr ppDevices);
        int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
    }

    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IMMDevice {
        int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
    }

    public static bool IsAudioPlaying() {
        try {
            CoInitializeEx(IntPtr.Zero, 0);
            
            Type enumeratorType = Type.GetTypeFromCLSID(CLSID_MMDeviceEnumerator);
            IMMDeviceEnumerator enumerator = (IMMDeviceEnumerator)Activator.CreateInstance(enumeratorType);
            
            IMMDevice device;
            enumerator.GetDefaultAudioEndpoint(0, 1, out device); // eRender, eMultimedia
            
            Guid iidMeter = IID_IAudioMeterInformation;
            object meterObj;
            device.Activate(ref iidMeter, 1, IntPtr.Zero, out meterObj);
            
            IAudioMeterInformation meter = (IAudioMeterInformation)meterObj;
            float peak;
            meter.GetPeakValue(out peak);
            
            // If peak > 0.001, audio is playing
            return peak > 0.001f;
        } catch {
            return false;
        }
    }
}
"@

try {
    $isPlaying = [AudioDetector]::IsAudioPlaying()
    if ($isPlaying) {
        Write-Output "true"
    } else {
        Write-Output "false"
    }
} catch {
    Write-Output "false"
}

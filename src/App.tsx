import { useEffect, useRef, useState } from "react";
import MainLayout from "./layouts/MainLayout";
import heroImg from "./assets/main-banner.png";
import BottomSheet from "./components/ui/BottomSheet";
import { SheetHeader, RadioCard, OtpInputGroup } from "./components/ui/OtpComponents";
import {
  ApiError,
  checkNumber,
  goToAuthorization,
  requestOtp,
  submitOtp,
  type AccountTargets,
  type AccountType,
  type OtpMethod,
} from "./api/auth";

const MAX_RESEND = 3;
const SEND_ERROR = "Gagal mengirim kode. Silakan coba lagi.";

type Destination = "phone" | "email";

const methodFor = (type: AccountType, dest: Destination): OtpMethod =>
  dest === "email" ? "emailLoginIndihome" : type === "telkomsel" ? "phoneLoginMobile" : "phoneLoginIndihome";

const TELKOMSEL_PREFIXES =["811", "812", "813", "821", "822", "823", "851", "852", "853"];

// Number is typed after the +62 label, without the leading 0 (e.g. 81234567890)
const validatePhone = (phone: string, type: "telkomsel" | "indihome") => {
  if (!phone) return "Nomor tidak boleh kosong";
  if (type !== "telkomsel") return null;
  if (!/^8\d{10,11}$/.test(phone)) return "Nomor tidak valid";
  if (!TELKOMSEL_PREFIXES.includes(phone.slice(0, 3))) return "Nomor tidak terdaftar";
  return null;
};

function App() {
  const [selected, setSelected] = useState<"telkomsel" | "indihome">("telkomsel");
  const [showSheet, setShowSheet] = useState(false);
  const [step, setStep] = useState<"select" | "verify">("select");
  const [destination, setDestination] = useState<Destination | null>(null);
  const [targets, setTargets] = useState<AccountTargets | null>(null);
  // Encrypted string from otp-request, sent back with the code on otp-submit
  const [otpData, setOtpData] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otp, setOtpState] = useState(["", "", "", ""]);
  const [otpError, setOtpError] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const [countdown, setCountdown] = useState(86);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const resendLimitReached = resendCount >= MAX_RESEND;

  const setOtp = (value: string[]) => {
    setOtpState(value);
    setOtpError(false);
  };

  const startVerify = () => {
    setOtp(["", "", "", ""]);
    setCountdown(86);
    setResendCount(0);
    setStep("verify");
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  };

  useEffect(() => {
    if (step !== "verify" || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step, countdown]);

  const targetFor = (dest: Destination | null, found = targets) =>
    dest === "phone" ? found?.mobile[0] : dest === "email" ? found?.email[0] : undefined;

  // Returns false when the OTP could not be sent
  const sendOtp = async (dest: Destination, found = targets) => {
    const target = targetFor(dest, found);
    if (!target) return false;
    try {
      setOtpData(await requestOtp(methodFor(selected, dest), target));
      return true;
    } catch {
      return false;
    }
  };

  const handleKirimOtp = async () => {
    const error = validatePhone(phone, selected);
    setPhoneError(error);
    if (error) return;
    setChecking(true);
    try {
      const found = await checkNumber(selected, selected === "telkomsel" ? `62${phone}` : phone).catch((e) => {
        setPhoneError(e instanceof ApiError && e.code === "NETWORK" ? SEND_ERROR : "Nomor tidak terdaftar");
        return null;
      });
      if (!found) return;
      if (!found.mobile.length && !found.email.length) {
        setPhoneError("Nomor tidak terdaftar");
        return;
      }
      setTargets(found);
      setSendError(false);
      if (selected === "indihome") {
        // IndiHome sends the code straight to the linked phone, no destination choice
        const dest = found.mobile.length ? "phone" : "email";
        if (!(await sendOtp(dest, found))) {
          setPhoneError(SEND_ERROR);
          return;
        }
        setDestination(dest);
        startVerify();
      } else {
        setDestination(null);
        setStep("select");
      }
      setShowSheet(true);
    } finally {
      setChecking(false);
    }
  };

  const handleSendCode = async () => {
    if (!destination) return;
    setSending(true);
    setSendError(false);
    try {
      if (await sendOtp(destination)) startVerify();
      else setSendError(true);
    } finally {
      setSending(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digits = value.replace(/\D/g, "");
    const newOtp = [...otp];
    if (digits.length <= 1) {
      newOtp[index] = digits;
      setOtp(newOtp);
      if (digits && index < 3) inputRefs.current[index + 1]?.focus();
      return;
    }
    // SMS autofill or typing over a filled box gives several digits at once
    const chars = (digits.length === 2 && otp[index] ? digits.slice(-1) : digits).split("");
    chars.slice(0, 4 - index).forEach((d, i) => (newOtp[index + i] = d));
    setOtp(newOtp);
    inputRefs.current[Math.min(index + chars.length, 3)]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      e.preventDefault();
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!pasted) return;
    const newOtp = ["", "", "", ""];
    pasted.split("").forEach((d, i) => (newOtp[i] = d));
    setOtp(newOtp);
    inputRefs.current[Math.min(pasted.length, 3)]?.focus();
  };

  const handleVerify = async () => {
    if (otp.some((d) => d === "") || !destination) return;
    setVerifying(true);
    try {
      await submitOtp(methodFor(selected, destination), otpData, otp.join(""));
      // The page leaves for CIAM, so the button stays in its loading state
      goToAuthorization();
    } catch {
      setOtpError(true);
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resendLimitReached || !destination) return;
    setSending(true);
    setSendError(false);
    try {
      if (!(await sendOtp(destination))) {
        setSendError(true);
        return;
      }
      setResendCount((c) => c + 1);
      setOtp(["", "", "", ""]);
      setCountdown(86);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setSending(false);
    }
  };

  const formatCountdown = () => {
    const m = Math.floor(countdown / 60);
    const s = countdown % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9]/g, "");
    if (selected === "telkomsel") {
      // Accept pasted 0812…, 62812… or +62812… formats
      val = val.replace(/^0+/, "").replace(/^62(?=8)/, "");
    }
    setPhone(val);
    setPhoneError(null);
  };

  const switchType = (type: "telkomsel" | "indihome") => {
    setSelected(type);
    setPhone("");
    setPhoneError(null);
  };

  return (
    <MainLayout>
      <div className="flex flex-col h-full min-h-0 relative">
        <img src={heroImg} alt="Insurance illustration" className="w-full shrink-0" />
        <div className="bg-white flex flex-col flex-1 px-[22px] pt-[24px] pb-[32px] gap-[16px] min-h-0">
          <p className="text-ink text-[16px] font-[600] leading-[24px]">
            Login untuk mengakses Insurance Hub
          </p>
          <div className="flex flex-row bg-[#f4f5f7] rounded-full p-[4px] w-full">
            <button
              type="button"
              onClick={() => switchType("telkomsel")}
              className={`flex-1 text-[12px] font-[600] rounded-full py-[8px] ${
                selected === "telkomsel" ? "bg-navy text-white" : "text-muted"
              }`}
            >
              Nomor Telkomsel
            </button>
            <button
              type="button"
              onClick={() => switchType("indihome")}
              className={`flex-1 text-[12px] font-[600] rounded-full py-[8px] ${
                selected === "indihome" ? "bg-navy text-white" : "text-muted"
              }`}
            >
              Nomor IndiHome
            </button>
          </div>
          <div className="flex flex-col gap-[8px]">
            <p className="text-ink text-[13px] font-[400]">
              {selected === "telkomsel"
                ? "Masukkan nomor Telkomsel Anda"
                : "Masukkan nomor IndiHome Anda"}
            </p>
            <div
              className={`flex flex-row items-center border rounded-[8px] bg-white h-[48px] overflow-hidden ${
                phoneError ? "border-primary" : "border-line focus-within:border-subtle"
              }`}
            >
              {selected === "telkomsel" && (
                <>
                  <span className="pl-[12px] pr-[8px] text-ink text-[14px] font-[400]">+62</span>
                  <div className="w-[1px] h-[20px] bg-line"></div>
                </>
              )}
              <input
                type="text"
                value={phone}
                onChange={handlePhoneChange}
                className={`flex-1 min-w-0 h-full pr-[12px] text-[14px] text-ink outline-none ${
                  selected === "telkomsel" ? "pl-[8px]" : "pl-[12px]"
                }`}
                inputMode="numeric"
                pattern="[0-9]*"
                aria-invalid={!!phoneError}
                aria-describedby={phoneError ? "phone-error" : undefined}
              />
              {phoneError && (
                <svg
                  className="mr-[12px] shrink-0"
                  width="18"
                  height="16"
                  viewBox="0 0 18 16"
                  aria-hidden="true"
                >
                  <path
                    d="M7.27 1a2 2 0 0 1 3.46 0l6.93 12a2 2 0 0 1-1.73 3H2.07a2 2 0 0 1-1.73-3z"
                    fill="#ED0226"
                  />
                  <path d="M9 5v5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="9" cy="12.6" r="1" fill="white" />
                </svg>
              )}
            </div>
            {phoneError && (
              <p id="phone-error" role="alert" className="text-primary text-[11px] -mt-[2px]">
                {phoneError}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleKirimOtp}
            disabled={checking}
            className="btn btn-primary h-[48px] text-[16px] font-[600] disabled:opacity-40"
          >
            {checking ? "Mengirim..." : "Kirim OTP"}
          </button>
          <p className="text-muted text-[12px] text-center leading-[18px]">
            Nomor tidak terisi otomatis? Masukkan nomor Anda secara manual.
          </p>
        </div>

        <BottomSheet open={showSheet} onClose={() => setShowSheet(false)}>
          {step === "select" && (
            <>
              <SheetHeader title="Pilih Tujuan OTP" onClose={() => setShowSheet(false)} />
              <p className="text-muted text-[12px] -mt-[8px]">
                Pilih ke mana OTP akan dikirimkan untuk verifikasi
              </p>
              {targets?.mobile[0] && (
                <RadioCard
                  selected={destination === "phone"}
                  onClick={() => setDestination("phone")}
                  title="Nomor Telkomsel"
                  subtitle={`(${targets.mobile[0].masked})`}
                />
              )}
              {targets?.email[0] && (
                <RadioCard
                  selected={destination === "email"}
                  onClick={() => setDestination("email")}
                  title="Email"
                  subtitle={`(${targets.email[0].masked})`}
                />
              )}
              {sendError && (
                <p role="alert" className="text-primary text-[11px]">
                  {SEND_ERROR}
                </p>
              )}
              <button
                onClick={handleSendCode}
                disabled={!destination || sending}
                className="btn btn-primary h-[48px] text-[16px] font-[600] disabled:opacity-40"
              >
                {sending ? "Mengirim..." : "Kirim Kode OTP"}
              </button>
            </>
          )}
          {step === "verify" && (
            <>
              <div className="flex flex-col items-center gap-[4px] pt-[8px] text-center">
                <p className="text-ink text-[16px] font-[600]">Masukkan kode verifikasi</p>
                <p className="text-[#5B6B85] text-[12px] leading-[18px] px-[16px]">
                  Kode verifikasi 4 digit telah dikirim ke{" "}
                  <span className="text-ink font-[600] whitespace-nowrap">
                    {targetFor(destination)?.masked}
                  </span>
                </p>
              </div>
              <div className="flex flex-col items-center gap-[12px] pt-[8px]">
                <p className="text-ink text-[12px] font-[400]">Kode Verifikasi</p>
                <OtpInputGroup
                  value={otp}
                  onChange={handleOtpChange}
                  onKeyDown={handleOtpKeyDown}
                  onPaste={handleOtpPaste}
                  inputRefs={inputRefs}
                  error={otpError}
                />
                {otpError && (
                  <p role="alert" className="text-primary text-[11px] -mt-[4px]">
                    Kode yang dimasukkan salah
                  </p>
                )}
              </div>
              <div className="flex flex-col items-center gap-[12px] text-center">
                <p className="text-ink text-[11px]">
                  Tidak menerima kode?{" "}
                  {countdown > 0 ? (
                    <span className="font-[600]">Silakan Menunggu {formatCountdown()}</span>
                  ) : (
                    <button
                      onClick={handleResend}
                      disabled={sending || resendLimitReached}
                      className="text-primary font-[600] disabled:text-subtle disabled:cursor-default"
                    >
                      {sending ? "Mengirim..." : "Kirim Ulang"}
                    </button>
                  )}
                </p>
                {sendError && (
                  <p role="alert" className="text-primary text-[11px] leading-[16px] px-[8px]">
                    {SEND_ERROR}
                  </p>
                )}
                {resendLimitReached && countdown === 0 && (
                  <p role="alert" className="text-primary text-[11px] leading-[16px] px-[8px]">
                    Batas kirim ulang tercapai. Silakan tunggu beberapa saat sebelum mencoba kembali.
                  </p>
                )}
              </div>
              <button
                onClick={handleVerify}
                disabled={otp.some((d) => d === "") || verifying}
                className="btn btn-primary h-[48px] text-[16px] font-[600] disabled:opacity-100 disabled:bg-line disabled:text-subtle"
              >
                {verifying ? "Memverifikasi..." : "Verifikasi"}
              </button>
            </>
          )}
        </BottomSheet>
      </div>
    </MainLayout>
  );
}

export default App;

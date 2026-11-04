import { useEffect, useRef, useState } from 'react'
import BottomSheet from '../../components/ui/BottomSheet'
import { SheetHeader, RadioCard, OtpInputGroup } from '../../components/ui/OtpComponents'

interface InsuranceHubLoginProps {
  onVerified?: () => void
}

export const InsuranceHubLogin = ({ onVerified }: InsuranceHubLoginProps) => {
  const [otpStep, setOtpStep] = useState<'none' | 'select' | 'verify'>('none')
  const [otpDestination, setOtpDestination] = useState<'phone' | 'email' | null>(null)
  const [otp, setOtp] = useState(['', '', '', ''])
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [countdown, setCountdown] = useState(86)
  const [error, setError] = useState<string | null>(null)
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    if (otpStep !== 'verify') return
    setCountdown(86)
    setError(null)
    setOtp(['', '', '', ''])
    setTimeout(() => {
      inputRefs.current[0]?.focus()
    }, 50)
  }, [otpStep])

  useEffect(() => {
    if (otpStep !== 'verify' || countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [otpStep, countdown])

  const startOtpFlow = () => {
    setOtpDestination(null)
    setError(null)
    setOtpStep('select')
  }

  const handleSendCode = async () => {
    if (!otpDestination) return
    setSending(true)
    setError(null)
    try {
      await new Promise((resolve) => setTimeout(resolve, 400))
      setOtpStep('verify')
    } catch (e) {
      setError('Gagal mengirim kode. Silakan coba lagi.')
    } finally {
      setSending(false)
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    if (!/^[0-9]?$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (pasted.length === 4) {
      setOtp(pasted.split(''))
      inputRefs.current[3]?.focus()
    }
  }

  const handleVerify = async () => {
    if (otp.some((d) => d === '')) return
    setVerifying(true)
    setError(null)
    try {
      await new Promise((resolve) => setTimeout(resolve, 400))
      setOtpStep('none')
      onVerified?.()
    } catch (e) {
      setError('Kode verifikasi salah. Silakan coba lagi.')
    } finally {
      setVerifying(false)
    }
  }

  const handleResend = async () => {
    if (countdown > 0) return
    setSending(true)
    setError(null)
    try {
      await new Promise((resolve) => setTimeout(resolve, 400))
      setOtp(['', '', '', ''])
      setCountdown(86)
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
    } catch (e) {
      setError('Gagal mengirim ulang kode. Silakan coba lagi.')
    } finally {
      setSending(false)
    }
  }

  const formatCountdown = () => {
    const m = Math.floor(countdown / 60)
    const s = countdown % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const closeSheets = () => {
    setOtpStep('none')
    setOtpDestination(null)
    setError(null)
  }

  return {
    startOtpFlow,
    sheets: (
      <>
        <BottomSheet open={otpStep === 'select'} onClose={closeSheets}>
          <SheetHeader title="Pilih Tujuan OTP" onClose={closeSheets} />
          <p className="text-muted text-[12px] -mt-[8px]">
            Pilih ke mana OTP akan dikirimkan untuk verifikasi
          </p>
          <RadioCard
            selected={otpDestination === 'phone'}
            onClick={() => setOtpDestination('phone')}
            title="Nomor Telkomsel"
            subtitle="(+62 812 **** 790)"
          />
          <RadioCard
            selected={otpDestination === 'email'}
            onClick={() => setOtpDestination('email')}
            title="Email"
            subtitle="(kir*****@gmail.com)"
          />
          {error && <p className="text-primary text-[12px]">{error}</p>}
          <button
            onClick={handleSendCode}
            disabled={!otpDestination || sending}
            className="btn btn-primary h-[48px] text-[16px] font-[600] disabled:opacity-40"
          >
            {sending ? 'Mengirim...' : 'Kirim Kode OTP'}
          </button>
        </BottomSheet>

        <BottomSheet open={otpStep === 'verify'} onClose={closeSheets}>
          <SheetHeader title="Masukkan kode verifikasi" onClose={closeSheets} />
          <p className="text-muted text-[12px] -mt-[8px]">
            Kode verifikasi 4 digit telah dikirim ke +62 812 **** 790
          </p>
          <div className="flex flex-col gap-[8px]">
            <p className="text-ink text-[13px] font-[400]">Kode Verifikasi</p>
            <OtpInputGroup
              value={otp}
              onChange={handleOtpChange}
              onKeyDown={handleOtpKeyDown}
              onPaste={handleOtpPaste}
              inputRefs={inputRefs}
            />
          </div>
          <p className="text-muted text-[12px]">
            Tidak menerima kode?{' '}
            {countdown > 0 ? (
              <span>Silakan Menunggu {formatCountdown()}</span>
            ) : (
              <button
                onClick={handleResend}
                disabled={sending}
                className="text-primary font-[600]"
              >
                {sending ? 'Mengirim...' : 'Kirim Ulang'}
              </button>
            )}
          </p>
          {error && <p className="text-primary text-[12px]">{error}</p>}
          <button
            onClick={handleVerify}
            disabled={otp.some((d) => d === '') || verifying}
            className="btn btn-primary h-[48px] text-[16px] font-[600] disabled:opacity-40"
          >
            {verifying ? 'Memverifikasi...' : 'Verifikasi'}
          </button>
        </BottomSheet>
      </>
    ),
  }
}

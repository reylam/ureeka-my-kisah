import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, ShieldAlert } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/forms/Field';
import { TextInput } from '@/components/forms/Inputs';
import { useAuthStore } from '@/stores/authStore';
import { ROLE_HOME } from '@/lib/permissions';
import { toast } from '@/stores/toastStore';

/**
 * Sign-in.
 *
 * The fields start empty; the form exercises its own validation rather than
 * arriving pre-filled. The sample accounts that used to be listed down the
 * side are in `docs/accounts.md` now, which is the right home for credentials
 * nobody needs to see mid-task.
 *
 * On success the destination comes from the role, not from a constant, so a
 * patient does not land on the clinical dashboard.
 */
const DEMO_ACCOUNTS = [
  { role: 'Pasien', email: 'patient@parupintas.test', password: 'Patient123!' },
  { role: 'Tenaga kesehatan', email: 'doctor@parupintas.test', password: 'Doctor123!' },
  { role: 'Administrator', email: 'admin@parupintas.test', password: 'Admin123!' },
] as const;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const signIn = useAuthStore((state) => state.signIn);
  const alreadySignedIn = useAuthStore((state) => Boolean(state.accountId));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const state = location.state as { from?: string; suspended?: boolean } | null;
  const from = state?.from;

  if (alreadySignedIn) return <Navigate to={from ?? '/app'} replace />;

  const validate = () => {
    const next: typeof errors = {};
    const trimmed = email.trim();
    if (!trimmed) next.email = 'Masukkan alamat email kamu.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
      next.email = 'Format email belum valid.';
    if (!password) next.password = 'Masukkan password kamu.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setErrors({});

    const result = await signIn(email, password);
    setSubmitting(false);

    if (!result.ok) {
      setErrors({ form: result.message });
      return;
    }

    toast.success(`Selamat datang kembali, ${result.account.name.split(' ')[0]}.`);
    navigate(from ?? ROLE_HOME[result.account.role], { replace: true });
  };

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Brand panel. Logo pinned top-left; the pitch sits centred in the
          remaining space, since the disclaimer that used to balance the
          bottom is gone. */}
      <div className="relative flex shrink-0 flex-col border-b border-obsidian-200 bg-white px-6 py-7 sm:px-10 lg:w-[26rem] lg:border-r lg:border-b-0 lg:py-10">
        <Link to="/" className="inline-flex w-fit">
          <Logo tone="dark" />
        </Link>

        <div className="mt-8 flex flex-col items-center text-center lg:mt-0 lg:flex-1 lg:justify-center">
          <h1 className="text-xl leading-snug font-semibold text-obsidian-950 lg:text-2xl">
            Masuk ke PARUPINTAS
          </h1>
          <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-obsidian-600">
            Pasien, petugas kesehatan, dan administrator masing-masing punya tampilan workspace
            yang berbeda.
          </p>

          <ul className="mt-6 space-y-2.5 text-[13px] text-obsidian-600">
            {[
              'Baca informasi TB dan direktori fasilitas tanpa perlu akun',
              'Daftar akan membuat akun pasien',
              'Datamu hanya bisa dilihat oleh kamu dan tim perawatmu',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-left">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ct-600" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-8 w-full max-w-sm rounded-xl border border-obsidian-200 bg-cloud p-4 text-left">
            <p className="text-[12px] font-semibold tracking-wide text-obsidian-500 uppercase">
              Akun demo
            </p>
            <ul className="mt-3 space-y-2">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.email}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(account.password);
                      setErrors({});
                    }}
                    className="w-full rounded-lg border border-obsidian-200 bg-white px-3 py-2 text-left transition-colors hover:border-ct-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ct-600"
                  >
                    <span className="block text-[12px] font-medium text-obsidian-950">
                      {account.role}
                    </span>
                    <span className="block font-mono text-[11.5px] text-obsidian-600">
                      {account.email}
                    </span>
                    <span className="block font-mono text-[11.5px] text-obsidian-600">
                      {account.password}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11.5px] leading-relaxed text-obsidian-500">
              Klik salah satu untuk mengisi formulir.
            </p>
          </div>        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-cloud px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-obsidian-500 transition-colors hover:text-obsidian-900"
          >
            <ArrowLeft aria-hidden className="size-3.5" />
            Kembali ke PARUPINTAS
          </Link>

          <h2 className="mt-5 text-lg font-semibold text-obsidian-950">Masuk</h2>
          <p className="mt-1 text-[13px] text-obsidian-500">
            Belum punya akun?{' '}
            <Link
              to="/register"
              className="font-medium text-ct-700 underline underline-offset-2 hover:text-ct-800"
            >
              Buat akun pasien
            </Link>
          </p>

          {state?.suspended ? (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-attention-300 bg-attention-50 px-3 py-2.5 text-[13px] text-attention-800"
            >
              <ShieldAlert aria-hidden className="mt-px size-4 shrink-0" />
              <span>Akun ini sedang ditangguhkan. Administrator perlu mengaktifkannya kembali.</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <Field label="Alamat email" error={errors.email ?? null} required>
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  describedBy={describedBy}
                  invalid={invalid}
                  leadingIcon={<Mail />}
                  placeholder="kamu@contoh.com"
                />
              )}
            </Field>

            <Field label="Password" error={errors.password ?? null} required>
              {({ id, describedBy, invalid }) => (
                <div className="relative">
                  <TextInput
                    id={id}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    describedBy={describedBy}
                    invalid={invalid}
                    leadingIcon={<Lock />}
                    placeholder="********"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-obsidian-400 transition-colors hover:bg-obsidian-100 hover:text-obsidian-700"
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden className="size-4" />
                    ) : (
                      <Eye aria-hidden className="size-4" />
                    )}
                  </button>
                </div>
              )}
            </Field>

            {errors.form ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-urgent-300/70 bg-urgent-50 px-3 py-2.5 text-[13px] text-urgent-800"
              >
                <ShieldAlert aria-hidden className="mt-px size-4 shrink-0" />
                <span>{errors.form}</span>
              </div>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              trailingIcon={<ArrowRight className="size-4" />}
            >
              {submitting ? 'Sedang masuk' : 'Masuk'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

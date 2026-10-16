import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, ShieldAlert, User } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/forms/Field';
import { TextInput } from '@/components/forms/Inputs';
import { useAuthStore } from '@/stores/authStore';
import { checkPasswordStrength } from '@/lib/passwordRules';
import { toast } from '@/stores/toastStore';
import { cn } from '@/utils/cn';

/**
 * Registration.
 *
 * Four fields and nothing else. Everything a screening workflow needs about a
 * person is asked later, during onboarding, where it can be explained and
 * consented to one step at a time. Asking for a date of birth and a symptom
 * list before someone has an account is how a sign-up form turns into a
 * medical intake questionnaire.
 *
 * There is no role selector, and `register` has no role argument to pass one
 * to. Every account created here is a patient: the database assigns the role
 * when the sign-up row is created and ignores anything the browser sends.
 */
export function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);
  const alreadySignedIn = useAuthStore((state) => Boolean(state.accountId));

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (alreadySignedIn) return <Navigate to="/app" replace />;

  const strength = checkPasswordStrength(form.password);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: '', form: '' }));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = 'Masukkan nama lengkap kamu.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = 'Masukkan alamat email yang valid.';
    if (!strength.ok) next.password = `Password harus memuat ${strength.problems.join(', ')}.`;
    if (form.confirm !== form.password) next.confirm = 'Kedua password tidak sama.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);

    const result = await register({ name: form.name, email: form.email, password: form.password });
    setSubmitting(false);

    if (!result.ok) {
      setErrors({ [result.field]: result.message });
      return;
    }

    // When the project requires email confirmation there is no session yet.
    if (result.confirmationRequired) {
      toast.success('Akun berhasil dibuat.', 'Cek email kamu untuk konfirmasi alamat, lalu masuk.');
      navigate('/login', { replace: true });
      return;
    }

    // Straight into the session and the dashboard. Asking someone to sign in
    // again, or to answer a questionnaire first, is a pointless extra step.
    toast.success('Akun berhasil dibuat.', 'Selamat datang di PULMO.');
    navigate('/app', { replace: true });
  };

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Logo pinned top-left; the pitch sits centred in the space below it. */}
      <div className="flex shrink-0 flex-col border-b border-obsidian-200 bg-white px-6 py-7 sm:px-10 lg:w-[28rem] lg:border-r lg:border-b-0 lg:py-10">
        <Link to="/" className="inline-flex w-fit">
          <Logo tone="dark" />
        </Link>

        <div className="mt-8 flex flex-col items-center text-center lg:mt-0 lg:flex-1 lg:justify-center">
          <h1 className="text-xl leading-snug font-semibold text-obsidian-950 lg:text-2xl">
            Buat akun pasien
          </h1>
          <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-obsidian-600">
            Simpan riwayat screening kamu di satu tempat, lihat jadwal follow-up, dan baca
            informasi TB yang ditulis untuk pasien, bukan untuk tenaga medis.
          </p>

          <ul className="mt-6 space-y-2.5 text-[13px] text-obsidian-600">
            {[
              'Datamu tetap milikmu. Pasien lain tidak bisa melihatnya.',
              'Pertanyaan kesehatan bersifat opsional dan dijelaskan dulu sebelum ditanyakan.',
              'Akun petugas kesehatan dan administrator dibuat oleh administrator, bukan di sini.',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-left">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ct-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-cloud px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-[13px] text-obsidian-500 transition-colors hover:text-obsidian-900"
          >
            <ArrowLeft aria-hidden className="size-3.5" />
            Aku sudah punya akun
          </Link>

          <h2 className="mt-5 text-lg font-semibold text-obsidian-950">Daftar</h2>
          <p className="mt-1 text-[13px] text-obsidian-500">Cuma butuh sekitar satu menit.</p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <Field label="Nama lengkap" error={errors.name ?? null} required>
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  autoComplete="name"
                  value={form.name}
                  onChange={set('name')}
                  describedBy={describedBy}
                  invalid={invalid}
                  leadingIcon={<User />}
                  placeholder="Siti Rahmawati"
                />
              )}
            </Field>

            <Field label="Alamat email" error={errors.email ?? null} required>
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  type="email"
                  autoComplete="username"
                  value={form.email}
                  onChange={set('email')}
                  describedBy={describedBy}
                  invalid={invalid}
                  leadingIcon={<Mail />}
                  placeholder="kamu@contoh.com"
                />
              )}
            </Field>

            <Field
              label="Password"
              error={errors.password ?? null}
              hint="Minimal 8 karakter, dengan huruf besar, huruf kecil, dan angka."
              required
            >
              {({ id, describedBy, invalid }) => (
                <div className="relative">
                  <TextInput
                    id={id}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={set('password')}
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

            {/* Live requirement list, so nobody has to submit to find out */}
            {form.password ? (
              <ul className="-mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {['minimal 8 karakter', 'huruf kecil', 'huruf besar', 'angka'].map(
                  (requirement) => {
                    const met = !strength.problems.includes(requirement);
                    return (
                      <li
                        key={requirement}
                        className={cn(
                          'text-[11.5px]',
                          met ? 'text-complete-700' : 'text-obsidian-400',
                        )}
                      >
                        {met ? '✓' : '·'} {requirement}
                      </li>
                    );
                  },
                )}
              </ul>
            ) : null}

            <Field label="Konfirmasi password" error={errors.confirm ?? null} required>
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={set('confirm')}
                  describedBy={describedBy}
                  invalid={invalid}
                  leadingIcon={<Lock />}
                  placeholder="***"
                />
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
              {submitting ? 'Membuat akun' : 'Buat akun'}
            </Button>
          </form>

          <p className="mt-5 border-t border-obsidian-200 pt-4 text-xs leading-relaxed text-obsidian-500">
            Password kamu diperiksa dan disimpan oleh layanan autentikasi. PULMO tidak akan
            melihatnya lagi setelah form ini dikirim.
          </p>
        </div>
      </div>
    </div>
  );
}

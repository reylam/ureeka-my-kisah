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
    if (!trimmed) next.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
      next.email = 'That does not look like an email address.';
    if (!password) next.password = 'Enter your password.';
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

    toast.success(`Welcome back, ${result.account.name.split(' ')[0]}.`);
    navigate(from ?? ROLE_HOME[result.account.role], { replace: true });
  };

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Brand panel. Logo pinned top-left; the pitch sits centred in the
          remaining space, since the disclaimer that used to balance the
          bottom is gone. */}
      <div className="on-dark relative flex shrink-0 flex-col bg-obsidian-950 px-6 py-7 sm:px-10 lg:w-[26rem] lg:py-10">
        <Link to="/" className="inline-flex w-fit">
          <Logo tone="light" />
        </Link>

        <div className="mt-8 flex flex-col items-center text-center lg:mt-0 lg:flex-1 lg:justify-center">
          <h1 className="text-xl leading-snug font-semibold text-white lg:text-2xl">
            Sign in to PULMO
          </h1>
          <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-obsidian-300">
            Patients, health workers and administrators each see a different workspace.
          </p>

          <ul className="mt-6 space-y-2.5 text-[13px] text-obsidian-300">
            {[
              'Browsing TB information and the facility directory needs no account',
              'Signing up creates a patient account',
              'Your records are only ever seen by you and your care team',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-left">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ct-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-cloud px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-obsidian-500 transition-colors hover:text-obsidian-900"
          >
            <ArrowLeft aria-hidden className="size-3.5" />
            Back to PULMO
          </Link>

          <h2 className="mt-5 text-lg font-semibold text-obsidian-950">Sign in</h2>
          <p className="mt-1 text-[13px] text-obsidian-500">
            New here?{' '}
            <Link
              to="/register"
              className="font-medium text-ct-700 underline underline-offset-2 hover:text-ct-800"
            >
              Create a patient account
            </Link>
          </p>

          {state?.suspended ? (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-attention-300 bg-attention-50 px-3 py-2.5 text-[13px] text-attention-800"
            >
              <ShieldAlert aria-hidden className="mt-px size-4 shrink-0" />
              <span>That account is suspended. An administrator has to reactivate it.</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <Field label="Email address" error={errors.email ?? null} required>
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
                  placeholder="you@example.com"
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
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
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
              {submitting ? 'Signing in' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

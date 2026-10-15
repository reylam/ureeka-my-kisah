import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, ShieldAlert } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/forms/Field';
import { TextInput } from '@/components/forms/Inputs';
import { DEMO_EMAIL, useAuthStore } from '@/stores/authStore';
import { DEMO_PASSWORD } from '@/data/users';
import { facilities, OPERATING_FACILITY_ID } from '@/data/facilities';
import { toast } from '@/stores/toastStore';

/**
 * Sign-in screen.
 *
 * Real validation and error handling, with the session established locally.
 * The fields arrive pre-filled so the prototype can be opened without hunting
 * for credentials, and the form still exercises its own validation paths if
 * you clear them.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const signIn = useAuthStore((state) => state.signIn);
  const alreadySignedIn = useAuthStore((state) => Boolean(state.userId));

  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  if (alreadySignedIn) return <Navigate to={from} replace />;

  const validate = () => {
    const next: typeof errors = {};
    const trimmed = email.trim();
    if (!trimmed) next.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
      next.email = 'That does not look like an email address.';
    if (!password) next.password = 'Enter your password.';
    else if (password.length < 6) next.password = 'Passwords are at least 6 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setErrors({});
    // Brief pause so the pending state is visible. No request is made.
    await new Promise((resolve) => window.setTimeout(resolve, 450));

    const result = signIn(email, password);
    setSubmitting(false);

    if (!result.ok) {
      setErrors({ form: result.message });
      return;
    }

    toast.success('Signed in.', 'All records in this prototype are synthetic.');
    navigate(from, { replace: true });
  };

  const facility = facilities.find((f) => f.id === OPERATING_FACILITY_ID);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Brand panel. The obsidian surface carries the identity. */}
      <div className="on-dark relative flex shrink-0 flex-col justify-between bg-obsidian-950 px-6 py-7 sm:px-10 lg:w-[28rem] lg:py-10">
        <Link to="/" className="inline-flex w-fit">
          <Logo tone="light" />
        </Link>

        <div className="mt-8 lg:mt-0">
          <h1 className="max-w-sm text-xl leading-snug font-semibold text-white lg:text-2xl">
            Preliminary TB screening for remote community health teams
          </h1>
          <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-obsidian-300">
            Record a screening, review the chest radiograph, raise a referral and keep track of who
            still needs contacting, on a connection that comes and goes.
          </p>

          <ul className="mt-6 space-y-2.5 text-[13px] text-obsidian-300">
            {[
              'Works offline; records are stored on the device until a sync runs',
              'Screening output always routed to a human reviewer',
              'Referral and follow-up tracking in one register',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ct-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-8 text-[11px] leading-relaxed text-obsidian-500 lg:mt-0">
          Prototype for evaluation. Not a medical device and not for clinical use. Every patient,
          facility and result is synthetic.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-cloud px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-obsidian-500 transition-colors hover:text-obsidian-900"
          >
            <ArrowLeft aria-hidden className="size-3.5" />
            Back to overview
          </Link>

          <h2 className="mt-5 text-lg font-semibold text-obsidian-950">Sign in</h2>
          <p className="mt-1 text-[13px] text-obsidian-500">
            {facility?.name} · {facility?.region}
          </p>

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
                  placeholder="name@facility.id"
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
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded text-obsidian-400 transition-colors hover:bg-obsidian-100 hover:text-obsidian-700"
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
                className="flex items-start gap-2.5 rounded-md border border-urgent-300/70 bg-urgent-50 px-3 py-2.5 text-[13px] text-urgent-800"
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

          <p className="mt-5 border-t border-obsidian-200 pt-4 text-xs leading-relaxed text-obsidian-500">
            Credentials are checked on this device only. Nothing is transmitted and no account is
            created, so this sign-in is not a security boundary.
          </p>
        </div>
      </div>
    </div>
  );
}

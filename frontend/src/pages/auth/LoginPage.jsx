import { Lock, LogIn } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import { FormField, Input } from '../../components/common/FormField';
import PageHeader from '../../components/common/PageHeader';
import { useAuth } from '../../context/AuthContext';

const EMPTY_FORM = { email: '', password: '' };

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = location.state?.from ?? '/dashboard';
  const update = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const validate = () => {
    const errors = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      errors.email = 'Enter your staff email address.';
    }
    if (form.password.length < 8) {
      errors.password = 'Passwords are at least 8 characters.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await signIn({
        email: form.email.trim(),
        password: form.password,
      });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      // The API returns one message for both a wrong email and a wrong
      // password on purpose; show it as-is rather than guessing which it was.
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader
        title="Staff sign-in"
        description="Inventory, sales, alerts and reservations are for pharmacy staff only."
      />

      <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormField
            label="Email address"
            htmlFor="email"
            error={fieldErrors.email}
            required
          >
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={update('email')}
              invalid={Boolean(fieldErrors.email)}
              autoComplete="username"
              autoFocus
            />
          </FormField>

          <FormField
            label="Password"
            htmlFor="password"
            error={fieldErrors.password}
            required
          >
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={update('password')}
              invalid={Boolean(fieldErrors.password)}
              autoComplete="current-password"
            />
          </FormField>

          {submitError && (
            <p role="alert" className="text-sm text-red-600">
              {submitError}
            </p>
          )}

          <Button type="submit" className="w-full" isLoading={isSubmitting}>
            <LogIn aria-hidden="true" className="size-4" />
            Sign in
          </Button>
        </form>

        <p className="mt-4 flex items-start gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          Sessions last 24 hours. Passwords are stored as scrypt digests and are
          never sent back to the browser.
        </p>
      </section>

      <p className="text-center text-sm text-slate-500">
        Looking for a medicine?{' '}
        <Link to="/" className="font-medium text-brand-700 hover:underline">
          Back to the catalogue
        </Link>
      </p>
    </div>
  );
}

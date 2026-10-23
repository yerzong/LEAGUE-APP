import type { AuthFormState } from '../actions';

export function FormMessage({ state }: { state: AuthFormState }) {
  if (state.status === 'idle') return null;
  const tone = state.status === 'error' ? 'text-danger' : 'text-success';
  return (
    <p role={state.status === 'error' ? 'alert' : 'status'} className={`text-sm ${tone}`}>
      {state.message}
    </p>
  );
}

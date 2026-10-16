import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';
import { AlertOctagon, Home, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Router-level error boundary. Shows the real error message, which in a
 * prototype is far more useful than a friendly dead end.
 */
export function RouteError() {
  const error = useRouteError();
  const navigate = useNavigate();

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Terjadi error yang tidak terduga.';

  return (
    <div className="flex min-h-dvh items-center justify-center bg-cloud px-4">
      <div className="w-full max-w-md rounded-card border border-obsidian-200 bg-white p-6 shadow-card">
        <div
          aria-hidden
          className="flex size-10 items-center justify-center rounded-full bg-urgent-50 text-urgent-700"
        >
          <AlertOctagon className="size-5" />
        </div>
        <h1 className="mt-4 text-base font-semibold text-obsidian-950">Ada yang error</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-obsidian-600">
          Halaman ini gagal ditampilkan. Data yang sudah kamu simpan tidak berubah.
        </p>
        <pre className="mt-3 max-h-40 overflow-auto rounded-md border border-obsidian-200 bg-obsidian-50 p-3 font-mono text-xs break-words whitespace-pre-wrap text-obsidian-700">
          {message}
        </pre>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="primary"
            leadingIcon={<RotateCcw className="size-4" />}
            onClick={() => window.location.reload()}
          >
            Muat ulang
          </Button>
          <Button
            variant="outline"
            leadingIcon={<Home className="size-4" />}
            onClick={() => navigate('/dashboard')}
          >
            Kembali ke dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

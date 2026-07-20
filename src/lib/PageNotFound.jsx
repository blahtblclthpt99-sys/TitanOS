import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function PageNotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const pageName = location.pathname.substring(1);
  const { user, isAuthenticated, authChecked } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#0A0A0B]">
      <div className="max-w-md w-full">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-7xl font-light text-white/20">404</h1>
            <div className="h-0.5 w-16 bg-white/10 mx-auto" />
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-medium text-white">
              Page Not Found
            </h2>
            <p className="text-white/50 leading-relaxed">
              The page <span className="font-medium text-white/70">&ldquo;{pageName || '/'}&rdquo;</span> could not be found in this application.
            </p>
          </div>

          {authChecked && isAuthenticated && user?.role === 'admin' && (
            <div className="mt-8 p-4 glass rounded-2xl text-left">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-titan-amber/20 flex items-center justify-center mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-titan-amber" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white/80">Admin Note</p>
                  <p className="text-sm text-white/50 leading-relaxed">
                    This could mean that the AI hasn&apos;t implemented this page yet. Ask it to implement it in the chat.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="pt-6">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-md border border-white/10 text-white text-sm font-semibold hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

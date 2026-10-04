import { Route, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { Home } from '@/pages/home';
import { LoginPage } from '@/pages/login';
import { RegisterPage } from '@/pages/register';
import { SearchPage } from '@/pages/search';
import { ListingDetail } from '@/pages/listing-detail';
import { StudentMessagesRoute, OwnerMessagesRoute } from '@/pages/messages';
import { StudentProfileRoute, OwnerProfileRoute } from '@/pages/profile';
import { OwnerDashboard } from '@/pages/owner-dashboard';
import { NewListingPage } from '@/pages/new-listing';
import { WaitlistPage } from '@/pages/waitlist';
import { WaitlistConfirmedPage } from '@/pages/waitlist-confirmed';
import { ChiSiamoPage } from '@/pages/chi-siamo';
import { ContattiPage } from '@/pages/contatti';
import { PrivacyPage } from '@/pages/privacy';
import { TerminiPage } from '@/pages/termini';
import { CookiePage } from '@/pages/cookie';
import { RequireAuth } from '@/components/RequireAuth';
import { RequireAdmin } from '@/components/RequireAdmin';
import { RequireOwner } from '@/components/RequireOwner';

export function Router() {
  const [location] = useLocation();

  return (
    <ErrorBoundary resetKey={location}>
      <Switch>
        {/* The app now opens on the login page instead of Home. */}
        <Route path="/" component={WaitlistPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/home">
          <RequireAdmin allowOwner>
            <Home />
          </RequireAdmin>
        </Route>
        <Route path="/search">
          <RequireAdmin allowOwner>
            <SearchPage />
          </RequireAdmin>
        </Route>
        <Route path="/listings/:id">
          <RequireAdmin allowOwner>
            <ListingDetail />
          </RequireAdmin>
        </Route>
        <Route path="/messages/:id?">
          <RequireAdmin allowOwner>
            <StudentMessagesRoute />
          </RequireAdmin>
        </Route>
        <Route path="/profile">
          <RequireAuth>
            <StudentProfileRoute />
          </RequireAuth>
        </Route>
        <Route path="/owner/listings/new">
          <RequireAuth>
            <RequireOwner>
              <NewListingPage />
            </RequireOwner>
          </RequireAuth>
        </Route>
        <Route path="/owner/messages/:id?">
          <RequireAuth>
            <OwnerMessagesRoute />
          </RequireAuth>
        </Route>
        <Route path="/owner/profile">
          <RequireAuth>
            <RequireOwner>
              <OwnerProfileRoute />
            </RequireOwner>
          </RequireAuth>
        </Route>
        <Route path="/owner">
          <RequireAuth>
            <RequireOwner>
              <OwnerDashboard />
            </RequireOwner>
          </RequireAuth>
        </Route>
        <Route path="/waitlist" component={WaitlistPage} />
        <Route path="/waitlist/confirmed" component={WaitlistConfirmedPage} />
        <Route path="/chi-siamo" component={ChiSiamoPage} />
        <Route path="/contatti" component={ContattiPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/termini" component={TerminiPage} />
        <Route path="/cookie" component={CookiePage} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}
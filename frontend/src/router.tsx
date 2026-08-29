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

export function Router() {
  const [location] = useLocation();

  return (
    <ErrorBoundary resetKey={location}>
      <Switch>
        {/* The app now opens on the login page instead of Home. */}
        <Route path="/" component={WaitlistPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/home" component={Home} />
        <Route path="/search" component={SearchPage} />
        <Route path="/listings/:id" component={ListingDetail} />
        <Route path="/messages/:id" component={StudentMessagesRoute} />
        <Route path="/messages" component={StudentMessagesRoute} />
        <Route path="/profile" component={StudentProfileRoute} />
        <Route path="/owner/listings/new" component={NewListingPage} />
        <Route path="/owner/messages" component={OwnerMessagesRoute} />
        <Route path="/owner/profile" component={OwnerProfileRoute} />
        <Route path="/owner" component={OwnerDashboard} />
        <Route path="/waitlist" component={WaitlistPage} />
        <Route path="/waitlist/confirmed" component={WaitlistConfirmedPage} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

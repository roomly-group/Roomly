import { Route, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { Home } from '@/pages/home';
import { LoginPage } from '@/pages/login';
import { RegisterPage } from '@/pages/register';
import { SearchPage } from '@/pages/search';
import { ListingDetail } from '@/pages/listing-detail';
import { RoomsPage } from '@/pages/rooms';
import { RoomDetailPage } from '@/pages/room-detail';
import { StudentMessagesRoute, OwnerMessagesRoute } from '@/pages/messages';
import { StudentProfileRoute, OwnerProfileRoute } from '@/pages/profile';
import { OwnerDashboard } from '@/pages/owner-dashboard';
import { NewListingPage } from '@/pages/new-listing';
import { EditListingPage } from '@/pages/edit-listing';
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
import { APP_ROUTES } from '@/lib/constants';

export function Router() {
  const [location] = useLocation();

  return (
    <ErrorBoundary resetKey={location}>
      <Switch>
        {/* The app now opens on the login page instead of Home. */}
        <Route path={APP_ROUTES.ROOT} component={WaitlistPage} />
        <Route path={APP_ROUTES.LOGIN} component={LoginPage} />
        <Route path={APP_ROUTES.REGISTER} component={RegisterPage} />
        <Route path={APP_ROUTES.HOME}>
          <RequireAdmin allowOwner>
            <Home />
          </RequireAdmin>
        </Route>
        <Route path={APP_ROUTES.SEARCH}>
          <RequireAdmin allowOwner>
            <SearchPage />
          </RequireAdmin>
        </Route>
        <Route path={APP_ROUTES.ROOMS}>
          <RequireAuth>
            <RoomsPage />
          </RequireAuth>
        </Route>
        <Route path={APP_ROUTES.ROOM_DETAIL}>
          <RequireAuth>
            <RoomDetailPage />
          </RequireAuth>
        </Route>
        <Route path={APP_ROUTES.LISTING_DETAIL}>
          <RequireAdmin allowOwner>
            <ListingDetail />
          </RequireAdmin>
        </Route>
        <Route path={APP_ROUTES.MESSAGE_DETAIL}>
          <RequireAdmin allowOwner>
            <StudentMessagesRoute />
          </RequireAdmin>
        </Route>
        <Route path={APP_ROUTES.PROFILE}>
          <RequireAuth>
            <StudentProfileRoute />
          </RequireAuth>
        </Route>
        <Route path={APP_ROUTES.OWNER_LISTING_NEW}>
          <RequireAuth>
            <RequireOwner>
              <NewListingPage />
            </RequireOwner>
          </RequireAuth>
        </Route>
        <Route path={APP_ROUTES.OWNER_MESSAGE_DETAIL}>
          <RequireAuth>
            <OwnerMessagesRoute />
          </RequireAuth>
        </Route>
        <Route path={APP_ROUTES.OWNER_PROFILE}>
          <RequireAuth>
            <RequireOwner>
              <OwnerProfileRoute />
            </RequireOwner>
          </RequireAuth>
        </Route>
        <Route path={APP_ROUTES.OWNER_LISTING_EDIT}>
          <RequireAuth>
            <RequireOwner>
              <EditListingPage />
            </RequireOwner>
          </RequireAuth>
        </Route>
        <Route path={APP_ROUTES.OWNER_DASHBOARD}>
          <RequireAuth>
            <RequireOwner>
              <OwnerDashboard />
            </RequireOwner>
          </RequireAuth>
        </Route>
        <Route path={APP_ROUTES.WAITLIST} component={WaitlistPage} />
        <Route path={APP_ROUTES.WAITLIST_CONFIRMED} component={WaitlistConfirmedPage} />
        <Route path={APP_ROUTES.ABOUT} component={ChiSiamoPage} />
        <Route path={APP_ROUTES.CONTACT} component={ContattiPage} />
        <Route path={APP_ROUTES.PRIVACY} component={PrivacyPage} />
        <Route path={APP_ROUTES.TERMS} component={TerminiPage} />
        <Route path={APP_ROUTES.COOKIES} component={CookiePage} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}
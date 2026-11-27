import { TournamentRouteReuse } from './tournament-route-reuse';
import { MatchupPrintSheetComponent, MatchupPrintSixComponent } from './matchup-print-sheet.component';
import { MatRadioModule } from '@angular/material/radio';
import { PageLoadingComponent } from './page-loading.component';
import { AppearanceComponent } from './appearance.component';
import { ManageScheduleComponent } from './schedule-management/manage-schedule.component';
import { ServiceWorkerModule } from '@angular/service-worker';
import { environment } from '../environments/environment';
import { InstallLocallyComponent } from './pwa/install-locally.component';
import { TeamRosterButtonComponent, TeamRosterDialogComponent } from './team-roster/team-roster.component';
import { ExistingPlayerBrowserComponent } from './league-management/existing-player-browser.component';
import { PlayerImportComponent } from './league-management/player-import.component';
import { LeaguePlayerEditComponent, ImportPlayerCreateComponent } from './league-management/player-management-dialogs.component';
import { PlayerHomeDashboardComponent } from './player-home-dashboard/player-home-dashboard.component';
import { PlayerAttendanceComponent } from './player-attendance/player-attendance.component';
import { PlayerNextGameComponent } from './player-next-game/player-next-game.component';
import { BrowserModule } from '@angular/platform-browser';
import { APP_ID, NgModule, inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { RouteReuseStrategy, RouterModule, Router } from '@angular/router';

import { AppComponent } from './app.component';
import { NavMenuComponent } from './nav-menu/nav-menu.component';
import { EventFacilityComponent } from './facilities/event-facility.component';
import { FacilityPickerComponent } from './facilities/facility-picker.component';
import { EventHomeComponent } from './home/event-home.component';
import { GoogleSignInComponent } from './google-auth/google-sign-in.component';
import { HomeComponent } from './home/home.component';
import { AccountRecoveryComponent } from './account-recovery.component';
import { ScramblerComponent } from './scrambler/scrambler.component';
import { LeagueManagementGuard, ScramblerWorkspaceComponent, WorkspaceRouteComponent, LeagueManagementDeniedComponent, requireSignedInTournament } from './scrambler/scrambler-workspace.component';
import { FetchDataComponent } from './fetch-data/fetch-data.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatOptionModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { OverlayModule } from '@angular/cdk/overlay';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarContainer, MatSnackBarModule } from '@angular/material/snack-bar';
import { LeagueHubSnackBar } from './league-hub-snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTreeModule } from '@angular/material/tree';
import { TeamScoresComponent } from './team-scores/team-scores.component';
import { PlayerScoresComponent } from './player-scores/player-scores.component';
import { ScheduleComponent } from './schedule/schedule.component';
import { AuthService } from './auth.service';
import { ForgotPasswordDialogComponent } from './forgot-password-dialog/forgot-password-dialog.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { DetailedPlayerStatsComponent } from './detailed-player-stats/detailed-player-stats.component';
import { SignInComponent } from './sign-in/sign-in.component';
import { CreateTeamsComponent } from './create-teams/create-teams.component';
import { LeagueStandingsComponent } from './league-standings/league-standings.component';
import { LeagueDashboardComponent } from './league-dashboard/league-dashboard.component';
import { LeagueTeamsComponent } from './league-teams/league-teams.component';
import { TeamManagementComponent } from './team-management/team-management.component';
import { LeagueScheduleComponent } from './league-schedule/league-schedule.component';
import { LeagueTeamPlayerScoresComponent } from './league-team-player-scores/league-team-player-scores.component';
import { PlayerStatsTabsComponent } from './player-stats-tabs/player-stats-tabs.component';
import { CombinedStatsTabComponent } from './combined-stats-tab/combined-stats-tab.component';
import { LeagueTeamStandingsComponent } from './league-team-standings/league-team-standings.component';
import { IndividualTeamScoresComponent } from './individual-team-scores/individual-team-scores.component';
import { FaqComponent } from './faq/faq.component';
import { KqmatchupsComponent } from './kqmatchups/kqmatchups.component';
import { KingQueenNavigationComponent } from './king-queen-navigation.component';

@NgModule({ declarations: [
        AppearanceComponent,
        AppComponent,
        NavMenuComponent,
        HomeComponent,
        PlayerHomeDashboardComponent,
        ScramblerComponent,
        FetchDataComponent,
        TeamScoresComponent,
        PlayerScoresComponent,
        ScheduleComponent,
        ForgotPasswordDialogComponent,
        ResetPasswordComponent,
        DetailedPlayerStatsComponent,
        SignInComponent,
        CreateTeamsComponent,
        LeagueDashboardComponent,
        LeagueScheduleComponent,
        LeagueTeamsComponent,
        TeamManagementComponent,
        LeagueTeamPlayerScoresComponent,
        PlayerStatsTabsComponent,
        PlayerNextGameComponent,
        InstallLocallyComponent,
        TeamRosterButtonComponent,
        TeamRosterDialogComponent,
        PlayerImportComponent,
        ManageScheduleComponent,
        LeaguePlayerEditComponent,
        ImportPlayerCreateComponent,
        PlayerAttendanceComponent,
        CombinedStatsTabComponent,
        LeagueTeamStandingsComponent,
        IndividualTeamScoresComponent,
        FaqComponent,
        KqmatchupsComponent,
        ScramblerWorkspaceComponent,
        WorkspaceRouteComponent,
        LeagueManagementDeniedComponent
    ],
    bootstrap: [AppComponent], imports: [BrowserModule,
        EventHomeComponent,
        EventFacilityComponent,
        FacilityPickerComponent,
        GoogleSignInComponent,
        AccountRecoveryComponent,
        FormsModule,
        MatInputModule,
        MatChipsModule,
        MatCardModule,
        MatButtonModule,
        MatSlideToggleModule,
        MatMenuModule, OverlayModule,
        MatProgressSpinnerModule, MatRadioModule,
        MatToolbarModule,
        MatIconModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatSidenavModule,
        MatTabsModule,
        MatTooltipModule,
        MatCheckboxModule,
        ReactiveFormsModule,
        MatGridListModule,
        MatSelectModule,
        MatFormFieldModule,
        MatListModule,
        MatOptionModule,
        MatAutocompleteModule,
        MatExpansionModule,
        MatDialogModule,
        MatStepperModule,
        MatNativeDateModule,
        MatDatepickerModule,
        MatTreeModule,
        MatSnackBarModule,
        PageLoadingComponent,
        MatchupPrintSheetComponent,
        MatchupPrintSixComponent,
        LeagueStandingsComponent,
        ExistingPlayerBrowserComponent,
        RouterModule.forRoot([
            { path: 'account-recovery', loadComponent: () => import('./account-recovery.component').then(m => m.AccountRecoveryComponent) },
            { path: 'change-email', data: { mode: 'email-change' }, loadComponent: () => import('./account-recovery.component').then(m => m.AccountRecoveryComponent) },
            { path: 'recovery-review', data: { mode: 'review' }, loadComponent: () => import('./account-recovery.component').then(m => m.AccountRecoveryComponent) },
            { path: 'access-denied', component: LeagueManagementDeniedComponent },
            { path: 'facilities', loadComponent: () => import('./facilities/facilities.component').then(m => m.FacilitiesComponent) },
            { path: 'facilities/:id/events/:eventId', loadComponent: () => import('./facilities/facilities.component').then(m => m.FacilitiesComponent) },
            { path: 'facilities/:id', loadComponent: () => import('./facilities/facilities.component').then(m => m.FacilitiesComponent) },
            { path: 'pickup', loadComponent: () => import('./pickup.component').then(m => m.PickupComponent) },
            { path: 'pickup/find', data: { view: 'find' }, loadComponent: () => import('./pickup.component').then(m => m.PickupComponent) },
            { path: 'pickup/create', data: { view: 'create' }, loadComponent: () => import('./pickup.component').then(m => m.PickupComponent) },
            { path: 'pickup/mine', data: { view: 'mine' }, loadComponent: () => import('./pickup.component').then(m => m.PickupComponent) },
            { path: 'pickup/:sessionId', loadComponent: () => import('./pickup.component').then(m => m.PickupComponent) },
            { path: 'tournament', canActivate: [requireSignedInTournament], loadComponent: () => import('./tournament-landing.component').then(m => m.TournamentLandingComponent) },
            { path: 'tournament/:leagueId', data: { tournamentContext: true }, canDeactivate: [(component: { canLeave(): Promise<boolean> }) => component.canLeave()], canActivate: [requireSignedInTournament], loadComponent: () => import('./tournament-center.component').then(m => m.TournamentCenterComponent) },
            { path: 'tournament/:leagueId/rounds', data: { tournamentContext: true }, loadComponent: () => import('./tournament-matchups.component').then(m => m.TournamentMatchupsComponent) },
            { path: 'tournament/:leagueId/check-in', redirectTo: ({ params }) => inject(Router).createUrlTree(['/'], { queryParams: { leagueId: params['leagueId'] }, fragment: 'attendance' }), pathMatch: 'full' },
            { path: 'connected-accounts', title: 'Connected Accounts', loadComponent: () => import('./google-auth/connected-accounts.component').then(m => m.ConnectedAccountsComponent) },
            { path: 'privacy', title: "Privacy Policy | Allport's League Hub", data: { document: 'privacy' }, loadComponent: () => import('./legal/legal.component').then(m => m.LegalComponent) },
            { path: 'terms', title: "Terms of Service | Allport's League Hub", loadComponent: () => import('./legal/legal.component').then(m => m.LegalComponent) },
            { path: '', component: HomeComponent, pathMatch: 'full' },
            { path: '', component: ScramblerWorkspaceComponent, children: [
                    { path: 'scrambler', component: WorkspaceRouteComponent },
                    { path: 'league-management', component: WorkspaceRouteComponent, canActivate: [LeagueManagementGuard] }
                ] },
            { path: 'fetch-data', component: FetchDataComponent },
            { path: 'team-scores', component: TeamScoresComponent },
            { path: 'player-scores', component: PlayerScoresComponent },
            { path: 'schedule', component: ScheduleComponent },
            { path: 'resetpassword', component: ResetPasswordComponent },
            { path: 'player-stats/:playerId', redirectTo: 'player-stats-tabs/:playerId', pathMatch: 'full' },
            { path: 'sign-in', component: SignInComponent },
            { path: 'player-stats-tabs/:playerId', component: PlayerStatsTabsComponent },
            { path: 'league-dashboard', component: LeagueDashboardComponent },
            { path: 'faq', component: FaqComponent },
            { path: 'install-locally', component: InstallLocallyComponent },
            { path: '', component: KingQueenNavigationComponent, children: [
                { path: 'standings', component: LeagueStandingsComponent },
                { path: 'kqmatchups', component: KqmatchupsComponent }
            ] }
        ], {}),
        ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production }),
        BrowserAnimationsModule], providers: [{ provide: RouteReuseStrategy, useClass: TournamentRouteReuse }, { provide: APP_ID, useValue: 'ng-cli-universal' }, { provide: MatSnackBar, useClass: LeagueHubSnackBar }, AuthService, provideHttpClient(withXhr(), withInterceptorsFromDi())] })
export class AppModule { }

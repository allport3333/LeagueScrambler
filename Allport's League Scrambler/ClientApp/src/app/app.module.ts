import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';

import { AppComponent } from './app.component';
import { NavMenuComponent } from './nav-menu/nav-menu.component';
import { HomeComponent } from './home/home.component';
import { ScramblerComponent } from './scrambler/scrambler.component';
import { FetchDataComponent } from './fetch-data/fetch-data.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {
    MatCardModule, MatButtonModule, MatMenuModule, MatToolbarModule, MatInputModule, MatIconModule, MatTableModule, MatPaginatorModule, MatSortModule, MatSidenavModule,
    MatTabsModule, MatTooltipModule, MatCheckboxModule, MatGridListModule, MatSelectModule, MatListModule, MatFormFieldModule, MatOptionModule, MatAutocompleteModule, MatExpansionModule, MatDialogModule,
    MatStepperModule, MatDatepickerModule, MatNativeDateModule, MatTreeModule
} from '@angular/material';
import { TeamScoresComponent } from './team-scores/team-scores.component';
import { PlayerScoresComponent } from './player-scores/player-scores.component';
import { ScheduleComponent } from './schedule/schedule.component';

@NgModule({
    declarations: [
        AppComponent,
        NavMenuComponent,
        HomeComponent,
        ScramblerComponent,
        FetchDataComponent,
        TeamScoresComponent,
        PlayerScoresComponent,
        ScheduleComponent

    ],
    imports: [
        BrowserModule.withServerTransition({ appId: 'ng-cli-universal' }),
        HttpClientModule,
        FormsModule,
        MatInputModule,
        MatCardModule,
        MatButtonModule,
        MatMenuModule,
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
        MatListModule,
        MatOptionModule,
        MatAutocompleteModule,
        MatExpansionModule,
        MatDialogModule,
        MatStepperModule,
        MatNativeDateModule,
        MatDatepickerModule,
        MatTreeModule,
        RouterModule.forRoot([
            { path: '', component: HomeComponent, pathMatch: 'full' },
            { path: 'scrambler', component: ScramblerComponent },
            { path: 'fetch-data', component: FetchDataComponent },
            { path: 'team-scores', component: TeamScoresComponent },
            { path: 'player-scores', component: PlayerScoresComponent },
            { path: 'schedule', component: ScheduleComponent }
        ]),
        BrowserAnimationsModule
    ],
    providers: [],
    bootstrap: [AppComponent]
})
export class AppModule { }

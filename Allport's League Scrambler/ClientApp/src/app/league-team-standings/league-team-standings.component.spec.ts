import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { LeagueTeamStandingsComponent } from './league-team-standings.component';

describe('LeagueTeamStandingsComponent', () => {
  let component: LeagueTeamStandingsComponent;
  let fixture: ComponentFixture<LeagueTeamStandingsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ LeagueTeamStandingsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(LeagueTeamStandingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

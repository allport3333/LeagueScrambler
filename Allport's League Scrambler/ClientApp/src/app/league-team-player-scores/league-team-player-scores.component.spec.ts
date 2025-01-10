import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { LeagueTeamPlayerScoresComponent } from './league-team-player-scores.component';

describe('LeagueTeamPlayerScoresComponent', () => {
  let component: LeagueTeamPlayerScoresComponent;
  let fixture: ComponentFixture<LeagueTeamPlayerScoresComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ LeagueTeamPlayerScoresComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(LeagueTeamPlayerScoresComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

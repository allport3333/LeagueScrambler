import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { LeagueTeamPlayerScoresComponent } from './league-team-player-scores.component';

describe('LeagueTeamPlayerScoresComponent', () => {
  let component: LeagueTeamPlayerScoresComponent;
  let fixture: ComponentFixture<LeagueTeamPlayerScoresComponent>;

  beforeEach(waitForAsync(() => {
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

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { LeagueScheduleComponent } from './league-schedule.component';

describe('LeagueScheduleComponent', () => {
  let component: LeagueScheduleComponent;
  let fixture: ComponentFixture<LeagueScheduleComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ LeagueScheduleComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(LeagueScheduleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

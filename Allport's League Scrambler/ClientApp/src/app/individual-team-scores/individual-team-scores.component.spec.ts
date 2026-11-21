import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { IndividualTeamScoresComponent } from './individual-team-scores.component';

describe('IndividualTeamScoresComponent', () => {
  let component: IndividualTeamScoresComponent;
  let fixture: ComponentFixture<IndividualTeamScoresComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ IndividualTeamScoresComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(IndividualTeamScoresComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

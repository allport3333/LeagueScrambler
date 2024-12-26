import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailedPlayerStatsComponent } from './detailed-player-stats.component';

describe('DetailedPlayerStatsComponent', () => {
  let component: DetailedPlayerStatsComponent;
  let fixture: ComponentFixture<DetailedPlayerStatsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DetailedPlayerStatsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DetailedPlayerStatsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { KqmatchupsComponent } from './kqmatchups.component';

describe('KqmatchupsComponent', () => {
  let component: KqmatchupsComponent;
  let fixture: ComponentFixture<KqmatchupsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ KqmatchupsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(KqmatchupsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

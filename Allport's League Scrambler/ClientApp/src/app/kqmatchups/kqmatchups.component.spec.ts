import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { KqmatchupsComponent } from './kqmatchups.component';

describe('KqmatchupsComponent', () => {
  let component: KqmatchupsComponent;
  let fixture: ComponentFixture<KqmatchupsComponent>;

  beforeEach(async(() => {
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

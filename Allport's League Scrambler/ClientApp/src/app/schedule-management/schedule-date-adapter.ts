import {Inject, Injectable, Optional} from '@angular/core';
import { MAT_DATE_LOCALE, NativeDateAdapter } from '@angular/material/core';
import {isoDay} from './schedule-engine';

// Keep typed ISO dates as local calendar dates, not UTC timestamps. Other input
// formats retain the application's existing Material native-adapter behavior.
@Injectable()
export class ScheduleDateAdapter extends NativeDateAdapter {
 constructor(@Optional() @Inject(MAT_DATE_LOCALE) locale:string) {
  super(locale);
 }

 parse(value:any):Date|null {
  if(typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
   const day=isoDay(value.trim());
   if(!day)return this.invalid();
   const parts=day.split('-').map(Number);
   return this.createDate(parts[0],parts[1]-1,parts[2]);
  }
  return super.parse(value);
 }
}

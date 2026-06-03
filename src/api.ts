import type { IDateTrackerAPI, IForgottenNoteInfo } from "./interfaces";
import type { ForgottenNotePicker } from "./services/forgotten-note-picker";

export class DateTrackerAPI implements IDateTrackerAPI {
  private readonly picker: ForgottenNotePicker;

  constructor(picker: ForgottenNotePicker) {
    this.picker = picker;
  }

  public async getForgottenNote(): Promise<IForgottenNoteInfo | null> {
    return this.picker.pick();
  }

  public async getForgottenNotes(count: number): Promise<IForgottenNoteInfo[]> {
    return this.picker.pickMultiple(count);
  }

  public getRotationIntervalMs(): number {
    return this.picker.getRotationIntervalMs();
  }
}

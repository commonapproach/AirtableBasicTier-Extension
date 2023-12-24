import { RecordInterface } from "./record.interface";

export type TableInterface = {
  id: string;
  name: string;
  rows: RecordInterface[];
  fields: { name: string; type: string; isPrimary: boolean; linkedTableId?: string; linkedTableName?: string }[];
};

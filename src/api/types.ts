export type GsmMode = "auto" | "agri";
export type GsmInstrument = "ДУТ" | "ДАРТ";

export interface GsmRowUpdate {
  reason?: string;
  mileage_gv?: number;
  reset_fields?: string[];
  instrument?: GsmInstrument;
  tank_capacity?: number;
  engine_hours_gv?: number;
  fueling_gv?: number;
  spent_gv?: number;
  balance_start_gv?: number;
  balance_end_gv?: number;
}

export interface GsmRowIdentity {
  date: string;
  equipment_number: string;
  gv_equipment: string | null;
}

export interface Comparison {
  one_c: number | null;
  gv: number | null;
  difference: number | null;
  gv_plus_3?: number | null;
  gv_plus_5?: number | null;
}

export interface TankValues {
  balance_start: number | null;
  balance_end: number | null;
  capacity: number | null;
}

export interface CommonRow {
  matching?: { status: "matched" | "ambiguous" | "one_c_only" | "gv_only"; sources: Array<Record<string, unknown>> };
  corrections?: Record<string, number>;
  source_values?: Record<string, number | null>;
  id: number | null;
  date: string | null;
  waybill_number: string | null;
  farm: string | null;
  equipment_number: string | null;
  gv_equipment: string | null;
  instrument: GsmInstrument | "";
  proved: boolean;
  engine_hours: Comparison;
  fueling: Comparison;
  spent: Comparison;
  tank: TankValues;
}

export interface AutoRow extends CommonRow {
  mileage: Comparison & { gv_plus_3: number | null };
}

export interface AgriRow extends CommonRow {
  work_volume: {
    tn: number | null;
    cn: number | null;
    ga: number | null;
  };
}

export interface ReportSummary {
  count: number;
  mileage: (Comparison & { gv_plus_3: number | null }) | null;
  work_volume?: {
    tn: number | null;
    cn: number | null;
    ga: number | null;
  };
  engine_hours: Comparison;
  fueling: Comparison;
  spent: Comparison;
  tank: TankValues;
}

export interface GsmTechnicOption {
  value: string;
  label: string;
}

export interface GsmFarmOption {
  value: string;
  label: string;
  merged?: boolean;
  members?: string[];
}

export interface GsmReportResponse {
  mode: GsmMode;
  date_from: string;
  date_to: string;
  rows: Array<AutoRow | AgriRow>;
  summary: ReportSummary;
  filters: {
    farms: GsmFarmOption[];
    technics: GsmTechnicOption[];
  };
}

export interface GsmQuery {
  from: string;
  to: string;
  farm?: string;
  technic?: string;
  mode: GsmMode;
}

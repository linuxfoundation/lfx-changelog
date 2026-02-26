export interface SelectOption {
  label: string;
  value: string;
}

export interface Tab {
  label: string;
  value: string;
}

export interface DropdownMenuItem {
  label: string;
  action: () => void;
  icon?: string;
  danger?: boolean;
}

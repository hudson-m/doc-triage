export interface Sample {
  readonly label: string;
  readonly text: string;
}

// Synthetic documents with fake personal data.
export const SAMPLES: readonly Sample[] = [
  {
    label: "Clear pay stub",
    text: "NORTHWIND TRADERS - EARNINGS STATEMENT\nPay period: 10/01/2026 - 10/15/2026\nGross pay 3,846.15\nNet pay 2,904.33\nYTD gross 76,923.00",
  },
  {
    label: "Ambiguous, with PII",
    text: "Payroll advice for Sam Rivera, SSN 512-44-9031\nHours worked 86 incl. overtime 6\nAmount transferred 2,611.02 to account 004417728391\nQuestions? payroll@tailspin.example",
  },
  {
    label: "Not a known type",
    text: "Dear Jordan, thank you for your application. We will review your documents within five business days.",
  },
];

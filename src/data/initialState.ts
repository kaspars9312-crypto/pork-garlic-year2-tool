import type { CompanyPosition, RuleStatus, RuleValue, Scenario, SpoilageRule, Year2Rules } from '../types/financial'

export const rule = <T>(value: T | null, status: RuleStatus = 'UNKNOWN', note = ''): RuleValue<T> => ({ value, status, note })

export const initialCompanyPosition: CompanyPosition = {
  startingCashForYear2: null,
  ownedMachines: [],
  outstandingLoans: [],
  unusedTaxLossCarryforward: null,
  year1AnnualProfit: null,
  isProvisional: true,
  sourceNote: 'Provisional until Year 1 Autumn is completed.',
}

export const initialRules: Year2Rules = {
  sellingPricePerUnit: rule<number>(null),
  milkPricePerTon: rule<number>(null),
  milkYieldUnitsPerTon: rule<number>(null),
  minimumMilkPurchaseTons: rule<number>(null),
  minimumMarketInvestment: rule<number>(null),
  fixedSalaries: rule<number>(null),
  bonusRate: rule<number>(null),
  taxRate: rule<number>(null),
  defaultLoanInterestRate: rule<number>(null),
  salesRequestBlockSize: rule<number>(null),
  salesAllocationMethod: rule('PROPORTIONAL_TO_PRODUCTION', 'ESTIMATE', 'Estimate based on Year 1 — not confirmed for Year 2.'),
  loanRepaymentRule: rule('EQUAL_SEASONAL_PRINCIPAL', 'ESTIMATE', 'Estimate based on Year 1 — not confirmed for Year 2.'),
  newLoanFirstPaymentTiming: rule('SAME_SEASON', 'ESTIMATE', 'Estimate based on Year 1 — not confirmed for Year 2.'),
  idleMachineCostTreatment: rule('MAINTENANCE_AND_DEPRECIATION', 'ESTIMATE', 'Estimate based on Year 1 — not confirmed for Year 2.'),
  milkStorageSpoilageRule: rule<SpoilageRule>(null),
  finishedProductSpoilageRule: rule<SpoilageRule>(null),
  totalWinterMarketForecastUnits: rule(410000, 'CONFIRMED', 'Total market forecast — not guaranteed company sales.'),
  premiseDefinitions: [],
  machineDefinitions: [],
}

export const blankScenario = (id: 'A' | 'B'): Scenario => ({
  id,
  name: `Scenario ${id}`,
  selectedPremiseIds: [],
  ownedMachineAssignments: {},
  newMachinePurchases: [],
  milkPurchasedTons: 0,
  plannedProductionByPremise: {},
  salesRequestUnits: 0,
  expectedSalesUnits: 0,
  actualSalesUnits: 0,
  salesAllocationMode: 'RULE_DEFAULT',
  marketInvestment: 0,
  newLoans: [],
})

/** Resets decisions while retaining the live premise catalog for immediate reselection. */
export const resetScenario = (id: 'A' | 'B', rules: Year2Rules): Scenario => ({
  ...blankScenario(id),
  plannedProductionByPremise: Object.fromEntries(
    rules.premiseDefinitions.map((premise) => [premise.id, 0]),
  ),
})

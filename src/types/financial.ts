export type RuleStatus = 'CONFIRMED' | 'ESTIMATE' | 'UNKNOWN'

export interface RuleValue<T> {
  value: T | null
  status: RuleStatus
  note: string
}

export interface DepreciationRule {
  method: 'SEASONAL_FIXED_AMOUNT' | 'STRAIGHT_LINE' | 'CUSTOM'
  seasonalAmount?: number
  description: string
}

export interface SpoilageRule {
  enabled: boolean
  financialTreatment: 'OPERATIONAL_ONLY' | 'ADDITIONAL_EXPENSE'
  description: string
}

export interface MachineDefinition {
  id: string
  name: string
  availabilityStatus: RuleStatus
  purchasePrice: RuleValue<number>
  capacityPerSeason: RuleValue<number>
  maintenancePerSeason: RuleValue<number>
  usefulLifeSeasons: RuleValue<number>
  depreciationRule: RuleValue<DepreciationRule>
}

export interface OwnedMachine {
  id: string
  machineDefinitionId: string | null
  machineTypeName: string
  originalPurchasePrice: number | null
  currentNetBookValue: number | null
  remainingUsefulLife: number | null
  seasonalDepreciation: RuleValue<number>
  maintenanceCost: RuleValue<number>
  capacity: RuleValue<number>
  installedPremiseId: string | null
  operatingStatus: 'ACTIVE' | 'IDLE'
  /** Matches a Scenario id when this asset was purchased in that scenario. */
  acquiredInScenarioId: string | null
}

export interface PremiseDefinition {
  id: string
  name: string
  availabilityStatus: RuleStatus
  machineSlots: RuleValue<number>
  rentPerSeason: RuleValue<number>
  transportRatePerSoldUnit: RuleValue<number>
}

export interface Loan {
  id: string
  label: string
  originalPrincipal: number
  remainingPrincipal: number
  borrowingSeason: string
  remainingTermSeasons: number
  interestRate: RuleValue<number>
  extraPrincipalRepayment: number
}

export interface CompanyPosition {
  startingCashForYear2: number | null
  ownedMachines: OwnedMachine[]
  outstandingLoans: Loan[]
  unusedTaxLossCarryforward: number | null
  year1AnnualProfit: number | null
  isProvisional: boolean
  sourceNote: string
}

export interface Year2Rules {
  sellingPricePerUnit: RuleValue<number>
  milkPricePerTon: RuleValue<number>
  milkYieldUnitsPerTon: RuleValue<number>
  minimumMilkPurchaseTons: RuleValue<number>
  minimumMarketInvestment: RuleValue<number>
  fixedSalaries: RuleValue<number>
  bonusRate: RuleValue<number>
  taxRate: RuleValue<number>
  defaultLoanInterestRate: RuleValue<number>
  salesRequestBlockSize: RuleValue<number>
  salesAllocationMethod: RuleValue<'PROPORTIONAL_TO_PRODUCTION' | 'MANUAL' | 'CUSTOM'>
  loanRepaymentRule: RuleValue<'EQUAL_SEASONAL_PRINCIPAL' | 'CUSTOM'>
  newLoanFirstPaymentTiming: RuleValue<'SAME_SEASON' | 'NEXT_SEASON'>
  idleMachineCostTreatment: RuleValue<'MAINTENANCE_AND_DEPRECIATION' | 'DEPRECIATION_ONLY' | 'NO_IDLE_COST'>
  milkStorageSpoilageRule: RuleValue<SpoilageRule>
  finishedProductSpoilageRule: RuleValue<SpoilageRule>
  totalWinterMarketForecastUnits: RuleValue<number>
  premiseDefinitions: PremiseDefinition[]
  machineDefinitions: MachineDefinition[]
}

export interface NewMachinePurchase {
  id: string
  machineDefinitionId: string
  installedPremiseId: string | null
}

export interface NewLoanRequest {
  id: string
  principal: number
  repaymentTermSeasons: number
  interestRateOverride?: RuleValue<number>
}

export interface Scenario {
  id: 'A' | 'B' | 'YEAR1_VALIDATION'
  name: string
  selectedPremiseIds: string[]
  ownedMachineAssignments: Record<string, string | null>
  newMachinePurchases: NewMachinePurchase[]
  milkPurchasedTons: number
  plannedProductionByPremise: Record<string, number>
  actualProductionByPremise?: Record<string, number>
  salesRequestUnits: number
  expectedSalesUnits: number
  actualSalesUnits: number
  salesAllocationMode: 'RULE_DEFAULT' | 'MANUAL'
  manualSalesAllocationByPremise?: Record<string, number>
  marketInvestment: number
  newLoans: NewLoanRequest[]
}

export interface ProfitAndLoss {
  revenue: number
  milkCost: number
  maintenance: number
  depreciation: number
  grossProfit: number
  transport: number
  marketInvestment: number
  bonus: number
  fixedSalaries: number
  premiseRent: number
  loanInterest: number
  profitBeforeTax: number
  gameTax: number
  netProfit: number
}

export interface TaxCalculation {
  openingTaxLossPool: number
  lossPoolUsed: number
  taxableProfit: number
  gameTax: number
  closingTaxLossPool: number
}

export interface CashFlow {
  openingCash: number
  newLoanReceived: number
  cashAvailableBeforeAdvancePayments: number
  machinePurchases: number
  cashBeforeMilkPayment: number
  milkPurchase: number
  cashBeforeMarketInvestment: number
  marketInvestment: number
  cashAfterAdvancePayments: number
  salesReceipts: number
  premiseRent: number
  maintenance: number
  transport: number
  fixedSalaries: number
  bonus: number
  loanPrincipalRepayment: number
  loanInterest: number
  gameTax: number
  closingCash: number
}

export interface LoanResult {
  loanId: string
  isNewBorrowing: boolean
  openingPrincipal: number
  newBorrowingReceivedThisSeason: number
  principalBeforeRepayment: number
  scheduledPrincipalRepayment: number
  extraPrincipalRepayment: number
  totalPrincipalRepayment: number
  interestCalculationBase: number
  interestPayment: number
  closingPrincipal: number
}

export interface MachineResult {
  machineId: string
  machineTypeName: string
  operatingStatus: 'ACTIVE' | 'IDLE'
  openingNetBookValue: number
  depreciationExpense: number
  closingNetBookValue: number
  openingRemainingUsefulLife: number
  closingRemainingUsefulLife: number
  maintenanceExpense: number
  activeCapacity: number
}

export interface PremiseResult {
  premiseId: string
  premiseName: string
  production: number
  allocatedSales: number
  transportCost: number
  installedActiveMachineCapacity: number
  unusedMachineCapacity: number
}

export interface OperationalIndicators {
  unitsProduced: number
  unitsSold: number
  unsoldFinishedUnits: number
  milkPurchasedTons: number
  milkRequiredForProductionTons: number
  unusedMilkEquivalentTons: number
  installedMachineCapacity: number
  unusedMachineCapacity: number
}

export interface ValidationIssue {
  id: string
  severity: 'WARNING' | 'ERROR'
  message: string
}

export interface ScenarioResult {
  premiseResults: PremiseResult[]
  machineResults: MachineResult[]
  loanResults: LoanResult[]
  profitAndLoss: ProfitAndLoss
  tax: TaxCalculation
  cashFlow: CashFlow
  indicators: OperationalIndicators
  validationIssues: ValidationIssue[]
  blockingUnknownRules: string[]
  requiredBorrowing: number
  closingDebt: number
}

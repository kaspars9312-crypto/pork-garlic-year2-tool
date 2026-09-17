import type { CompanyPosition, Scenario, ScenarioResult, Year2Rules } from '../types/financial'
import { rule } from './initialState'

export const year1WinterCompany: CompanyPosition = {
  startingCashForYear2: 100000,
  ownedMachines: [{
    id: 'machine-1',
    machineDefinitionId: null,
    machineTypeName: 'Machine 1',
    originalPurchasePrice: 35000,
    currentNetBookValue: 35000,
    remainingUsefulLife: 8,
    seasonalDepreciation: rule(4375, 'CONFIRMED'),
    maintenanceCost: rule(1800, 'CONFIRMED'),
    capacity: rule(72000, 'CONFIRMED'),
    installedPremiseId: 'premise-d',
    operatingStatus: 'ACTIVE',
    acquiredInScenarioId: 'YEAR1_VALIDATION',
  }],
  outstandingLoans: [],
  unusedTaxLossCarryforward: 0,
  year1AnnualProfit: null,
  isProvisional: false,
  sourceNote: 'Real played Year 1 Winter validation case.',
}

export const year1WinterRules: Year2Rules = {
  sellingPricePerUnit: rule(2, 'CONFIRMED'),
  milkPricePerTon: rule(20000, 'CONFIRMED'),
  milkYieldUnitsPerTon: rule(20000, 'CONFIRMED'),
  minimumMilkPurchaseTons: rule(0, 'CONFIRMED'),
  minimumMarketInvestment: rule(0, 'CONFIRMED'),
  fixedSalaries: rule(10000, 'CONFIRMED'),
  bonusRate: rule(0.05, 'CONFIRMED'),
  taxRate: rule(0.1, 'CONFIRMED'),
  defaultLoanInterestRate: rule(0, 'CONFIRMED'),
  salesRequestBlockSize: rule(10000, 'CONFIRMED'),
  salesAllocationMethod: rule('PROPORTIONAL_TO_PRODUCTION', 'CONFIRMED'),
  loanRepaymentRule: rule('EQUAL_SEASONAL_PRINCIPAL', 'CONFIRMED'),
  newLoanFirstPaymentTiming: rule('SAME_SEASON', 'CONFIRMED'),
  idleMachineCostTreatment: rule('MAINTENANCE_AND_DEPRECIATION', 'CONFIRMED'),
  milkStorageSpoilageRule: rule({ enabled: false, financialTreatment: 'OPERATIONAL_ONLY', description: 'Full milk purchase is already expensed.' }, 'CONFIRMED'),
  finishedProductSpoilageRule: rule({ enabled: false, financialTreatment: 'OPERATIONAL_ONLY', description: 'No extra Year 1 charge.' }, 'CONFIRMED'),
  totalWinterMarketForecastUnits: rule(410000, 'CONFIRMED', 'Not used in the Year 1 validation case.'),
  premiseDefinitions: [{
    id: 'premise-d',
    name: 'Premise D',
    availabilityStatus: 'CONFIRMED',
    machineSlots: rule(1, 'CONFIRMED'),
    rentPerSeason: rule(17000, 'CONFIRMED'),
    transportRatePerSoldUnit: rule(0.1, 'CONFIRMED'),
  }],
  machineDefinitions: [],
}

export const year1WinterScenario: Scenario = {
  id: 'YEAR1_VALIDATION',
  name: 'Year 1 Winter Validation',
  selectedPremiseIds: ['premise-d'],
  ownedMachineAssignments: { 'machine-1': 'premise-d' },
  newMachinePurchases: [],
  milkPurchasedTons: 3,
  plannedProductionByPremise: { 'premise-d': 60000 },
  actualProductionByPremise: { 'premise-d': 60000 },
  salesRequestUnits: 60000,
  expectedSalesUnits: 60000,
  actualSalesUnits: 60000,
  salesAllocationMode: 'RULE_DEFAULT',
  marketInvestment: 5000,
  newLoans: [],
}

export const year1Expected = {
  revenue: 120000,
  milkCost: 60000,
  maintenance: 1800,
  depreciation: 4375,
  grossProfit: 53825,
  transport: 6000,
  marketInvestment: 5000,
  bonus: 2691,
  fixedSalaries: 10000,
  premiseRent: 17000,
  profitBeforeTax: 13134,
  gameTax: 1313,
  netProfit: 11821,
  closingCash: 81196,
  closingMachineNbv: 30625,
}

/** A self-contained historical case; it never represents Year 2 opening data. */
export interface Year1ValidationCaseState {
  company: CompanyPosition
  rules: Year2Rules
  scenario: Scenario
}

export function createYear1WinterValidationCase(): Year1ValidationCaseState {
  return {
    company: structuredClone(year1WinterCompany),
    rules: structuredClone(year1WinterRules),
    scenario: structuredClone(year1WinterScenario),
  }
}

export function year1ValidationMismatches(result: ScenarioResult): string[] {
  const checks: [string, number, number][] = [
    ['Revenue', result.profitAndLoss.revenue, year1Expected.revenue], ['Milk cost', result.profitAndLoss.milkCost, year1Expected.milkCost], ['Maintenance', result.profitAndLoss.maintenance, year1Expected.maintenance], ['Depreciation', result.profitAndLoss.depreciation, year1Expected.depreciation], ['Gross Profit', result.profitAndLoss.grossProfit, year1Expected.grossProfit], ['Transport', result.profitAndLoss.transport, year1Expected.transport], ['Market investment', result.profitAndLoss.marketInvestment, year1Expected.marketInvestment], ['Bonus', result.profitAndLoss.bonus, year1Expected.bonus], ['Fixed salaries', result.profitAndLoss.fixedSalaries, year1Expected.fixedSalaries], ['Premise rent', result.profitAndLoss.premiseRent, year1Expected.premiseRent], ['Profit Before Tax', result.profitAndLoss.profitBeforeTax, year1Expected.profitBeforeTax], ['Game Tax', result.profitAndLoss.gameTax, year1Expected.gameTax], ['Net Profit', result.profitAndLoss.netProfit, year1Expected.netProfit], ['Closing Cash', result.cashFlow.closingCash, year1Expected.closingCash], ['Machine closing NBV', result.machineResults[0]?.closingNetBookValue ?? 0, year1Expected.closingMachineNbv],
  ]
  return checks.filter(([, actual, expected]) => actual !== expected).map(([label, actual, expected]) => `${label}: expected Sh ${expected.toLocaleString()}, received Sh ${actual.toLocaleString()}`)
}

import { describe, expect, it } from 'vitest'
import { calculateScenario, createStressTestScenarios } from '../calculations/scenario'
import { blankScenario, initialCompanyPosition, initialRules, resetScenario, rule } from '../data/initialState'
import { createYear1WinterValidationCase, year1Expected, year1WinterCompany, year1WinterRules, year1WinterScenario } from '../data/year1WinterValidationCase'

const copy = <T,>(value: T): T => structuredClone(value)
const calculateYear1 = () => calculateScenario({ company: copy(year1WinterCompany), rules: copy(year1WinterRules), scenario: copy(year1WinterScenario) })

describe('shared financial calculation engine', () => {
  it('resets Scenario A decisions while preserving premises for immediate reselection', () => {
    const rules = copy(initialRules)
    rules.premiseDefinitions.push({ id: 'test-premise', name: 'Test premise', availabilityStatus: 'ESTIMATE', machineSlots: rule(1, 'ESTIMATE'), rentPerSeason: rule(10, 'ESTIMATE'), transportRatePerSoldUnit: rule(0.1, 'ESTIMATE') })
    const selectedScenario = { ...blankScenario('A'), selectedPremiseIds: ['test-premise'], plannedProductionByPremise: { 'test-premise': 500 } }
    const reset = resetScenario('A', rules)
    expect(rules.premiseDefinitions).toHaveLength(1)
    expect(rules.premiseDefinitions[0].id).toBe('test-premise')
    expect(selectedScenario.selectedPremiseIds).toEqual(['test-premise'])
    expect(reset.selectedPremiseIds).toEqual([])
    expect(reset.plannedProductionByPremise['test-premise']).toBe(0)
  })

  it('loads the Winter validation case in dedicated state without modifying Year 2 closing position', () => {
    const year2PositionBefore = copy(initialCompanyPosition)
    const validationCase = createYear1WinterValidationCase()
    expect(initialCompanyPosition).toEqual(year2PositionBefore)
    expect(validationCase.company.startingCashForYear2).toBe(100000)
    expect(initialCompanyPosition.startingCashForYear2).toBeNull()
  })

  it('keeps Scenario B out of the dedicated Winter validation state', () => {
    const scenarioBBefore = blankScenario('B')
    const validationCase = createYear1WinterValidationCase()
    expect(scenarioBBefore).toEqual(blankScenario('B'))
    expect('scenarioB' in validationCase).toBe(false)
    expect(validationCase.scenario.id).toBe('YEAR1_VALIDATION')
  })

  it('passes the full Year 1 Winter validation case', () => {
    const result = calculateYear1()
    expect(result.profitAndLoss).toMatchObject({
      revenue: year1Expected.revenue, milkCost: year1Expected.milkCost, maintenance: year1Expected.maintenance,
      depreciation: year1Expected.depreciation, grossProfit: year1Expected.grossProfit, transport: year1Expected.transport,
      marketInvestment: year1Expected.marketInvestment, bonus: year1Expected.bonus, fixedSalaries: year1Expected.fixedSalaries,
      premiseRent: year1Expected.premiseRent, profitBeforeTax: year1Expected.profitBeforeTax, gameTax: year1Expected.gameTax, netProfit: year1Expected.netProfit,
    })
    expect(result.cashFlow.closingCash).toBe(year1Expected.closingCash)
    expect(result.machineResults[0].closingNetBookValue).toBe(year1Expected.closingMachineNbv)
  })

  it('flags production above milk capacity', () => {
    const scenario = copy(year1WinterScenario); scenario.plannedProductionByPremise['premise-d'] = 70000; scenario.actualProductionByPremise = { 'premise-d': 70000 }
    expect(calculateScenario({ company: year1WinterCompany, rules: year1WinterRules, scenario }).validationIssues.some((issue) => issue.id === 'milk-capacity')).toBe(true)
  })

  it('flags production above machine capacity', () => {
    const scenario = copy(year1WinterScenario); scenario.plannedProductionByPremise['premise-d'] = 80000; scenario.actualProductionByPremise = { 'premise-d': 80000 }
    expect(calculateScenario({ company: year1WinterCompany, rules: year1WinterRules, scenario }).validationIssues.some((issue) => issue.id === 'machine-capacity-premise-d')).toBe(true)
  })

  it('keeps revenue based on actual sales below production', () => {
    const scenario = copy(year1WinterScenario); scenario.actualSalesUnits = 40000
    const result = calculateScenario({ company: year1WinterCompany, rules: year1WinterRules, scenario })
    expect(result.profitAndLoss.revenue).toBe(80000)
    expect(result.indicators.unsoldFinishedUnits).toBe(20000)
  })

  it('allocates Year 1 sales proportionally by premise before separate transport', () => {
    const company = copy(year1WinterCompany)
    company.ownedMachines.push({ ...company.ownedMachines[0], id: 'machine-2', installedPremiseId: 'premise-e', acquiredInScenarioId: null, capacity: rule(72000, 'CONFIRMED') })
    const rules = copy(year1WinterRules)
    rules.premiseDefinitions.push({ id: 'premise-e', name: 'Premise E', availabilityStatus: 'CONFIRMED', machineSlots: rule(1, 'CONFIRMED'), rentPerSeason: rule(0, 'CONFIRMED'), transportRatePerSoldUnit: rule(0.2, 'CONFIRMED') })
    const scenario = copy(year1WinterScenario)
    scenario.selectedPremiseIds = ['premise-d', 'premise-e']; scenario.ownedMachineAssignments['machine-2'] = 'premise-e'
    scenario.plannedProductionByPremise = { 'premise-d': 30000, 'premise-e': 60000 }; scenario.actualProductionByPremise = { 'premise-d': 30000, 'premise-e': 60000 }; scenario.actualSalesUnits = 60000
    const result = calculateScenario({ company, rules, scenario })
    expect(result.premiseResults.map((premise) => premise.allocatedSales)).toEqual([20000, 40000])
    expect(result.premiseResults.map((premise) => premise.transportCost)).toEqual([2000, 8000])
  })

  it('borrowing increases cash but not revenue', () => {
    const scenario = copy(year1WinterScenario); scenario.newLoans = [{ id: 'loan-1', principal: 10000, repaymentTermSeasons: 2 }]
    const result = calculateScenario({ company: year1WinterCompany, rules: year1WinterRules, scenario })
    expect(result.profitAndLoss.revenue).toBe(120000)
    expect(result.cashFlow.newLoanReceived).toBe(10000)
    expect(result.cashFlow.cashAvailableBeforeAdvancePayments).toBe(110000)
  })

  it('applies same-season loan principal and interest', () => {
    const rules = copy(year1WinterRules); rules.defaultLoanInterestRate = rule(0.1, 'CONFIRMED')
    const scenario = copy(year1WinterScenario); scenario.newLoans = [{ id: 'loan-1', principal: 100, repaymentTermSeasons: 3 }]
    const loan = calculateScenario({ company: year1WinterCompany, rules, scenario }).loanResults[0]
    expect(loan).toMatchObject({ newBorrowingReceivedThisSeason: 100, scheduledPrincipalRepayment: 33, interestPayment: 10, closingPrincipal: 67 })
  })

  it('treats machine purchase as cash-only, not a P&L expense', () => {
    const rules = copy(year1WinterRules)
    rules.machineDefinitions.push({ id: 'new-machine', name: 'New machine', availabilityStatus: 'CONFIRMED', purchasePrice: rule(10000, 'CONFIRMED'), capacityPerSeason: rule(10000, 'CONFIRMED'), maintenancePerSeason: rule(0, 'CONFIRMED'), usefulLifeSeasons: rule(5, 'CONFIRMED'), depreciationRule: rule({ method: 'SEASONAL_FIXED_AMOUNT', seasonalAmount: 0, description: 'Test' }, 'CONFIRMED') })
    const scenario = copy(year1WinterScenario); scenario.newMachinePurchases = [{ id: 'new-1', machineDefinitionId: 'new-machine', installedPremiseId: 'premise-d' }]
    const baseline = calculateYear1(); const result = calculateScenario({ company: year1WinterCompany, rules, scenario })
    expect(result.profitAndLoss.netProfit).toBe(baseline.profitAndLoss.netProfit)
    expect(result.cashFlow.closingCash).toBe(baseline.cashFlow.closingCash - 10000)
  })

  it('reduces profit but not current cash for depreciation', () => {
    const noDepCompany = copy(year1WinterCompany); noDepCompany.ownedMachines[0].seasonalDepreciation = rule(0, 'CONFIRMED')
    const noTaxRules = copy(year1WinterRules); noTaxRules.taxRate = rule(0, 'CONFIRMED'); noTaxRules.bonusRate = rule(0, 'CONFIRMED')
    const withDep = calculateScenario({ company: year1WinterCompany, rules: noTaxRules, scenario: year1WinterScenario })
    const withoutDep = calculateScenario({ company: noDepCompany, rules: noTaxRules, scenario: year1WinterScenario })
    expect(withDep.profitAndLoss.netProfit).toBeLessThan(withoutDep.profitAndLoss.netProfit)
    expect(withDep.cashFlow.closingCash).toBe(withoutDep.cashFlow.closingCash)
  })

  it('uses tax-loss carryforward before calculating rounded tax', () => {
    const company = copy(year1WinterCompany); company.unusedTaxLossCarryforward = 10000
    const result = calculateScenario({ company, rules: year1WinterRules, scenario: year1WinterScenario })
    expect(result.tax).toMatchObject({ lossPoolUsed: 10000, taxableProfit: 3134, gameTax: 313 })
  })

  it('flags negative cash at an advance-payment checkpoint', () => {
    const company = copy(year1WinterCompany); company.startingCashForYear2 = 1
    const result = calculateScenario({ company, rules: year1WinterRules, scenario: year1WinterScenario })
    expect(result.validationIssues.some((issue) => issue.id === 'cash-before-milk')).toBe(true)
  })

  it('does not create revenue from unsold production', () => {
    const scenario = copy(year1WinterScenario); scenario.actualSalesUnits = 50000
    const result = calculateScenario({ company: year1WinterCompany, rules: year1WinterRules, scenario })
    expect(result.profitAndLoss.revenue).toBe(100000)
    expect(result.indicators.unsoldFinishedUnits).toBe(10000)
  })

  it('generates whole-unit stress-test sales quantities', () => {
    const scenario = copy(year1WinterScenario); scenario.salesRequestUnits = 33333
    expect(createStressTestScenarios(scenario).every((caseScenario) => Number.isInteger(caseScenario.actualSalesUnits))).toBe(true)
  })
})

import { roundShekels, wholeUnits } from './rounding'
import type {
  CompanyPosition,
  Loan,
  LoanResult,
  MachineResult,
  NewLoanRequest,
  PremiseDefinition,
  PremiseResult,
  RuleValue,
  Scenario,
  ScenarioResult,
  ValidationIssue,
  Year2Rules,
} from '../types/financial'

export interface CalculationInput {
  company: CompanyPosition
  rules: Year2Rules
  scenario: Scenario
}

const ruleNumber = (
  rule: RuleValue<number>,
  name: string,
  blocking: string[],
): number => {
  if (rule.status === 'UNKNOWN' || rule.value === null) {
    blocking.push(name)
    return 0
  }
  return rule.value
}

const addIssue = (issues: ValidationIssue[], id: string, message: string, severity: 'WARNING' | 'ERROR' = 'ERROR') =>
  issues.push({ id, severity, message })

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

const selectedPremises = (rules: Year2Rules, scenario: Scenario) =>
  rules.premiseDefinitions.filter((premise) => scenario.selectedPremiseIds.includes(premise.id))

function allocateSales(
  scenario: Scenario,
  premises: PremiseDefinition[],
  production: Record<string, number>,
  issues: ValidationIssue[],
): Record<string, number> {
  const allocation: Record<string, number> = Object.fromEntries(premises.map((premise) => [premise.id, 0]))
  if (scenario.salesAllocationMode === 'MANUAL') {
    const manual = scenario.manualSalesAllocationByPremise ?? {}
    const manualTotal = sum(Object.values(manual))
    if (manualTotal !== scenario.actualSalesUnits) {
      addIssue(issues, 'manual-sales-total', 'Manual sales allocation must total actual company sales.')
    }
    for (const [premiseId, units] of Object.entries(manual)) {
      if (!scenario.selectedPremiseIds.includes(premiseId)) {
        addIssue(issues, `manual-unselected-${premiseId}`, 'Sales cannot be allocated to an unselected premise.')
      }
      if (units > (production[premiseId] ?? 0)) {
        addIssue(issues, `manual-over-production-${premiseId}`, 'Premise sales allocation cannot exceed that premise’s production.')
      }
      allocation[premiseId] = wholeUnits(units)
    }
    return allocation
  }

  const totalProduction = sum(premises.map((premise) => production[premise.id] ?? 0))
  if (totalProduction <= 0) return allocation
  let allocated = 0
  premises.forEach((premise, index) => {
    const isLast = index === premises.length - 1
    const amount = isLast
      ? scenario.actualSalesUnits - allocated
      : wholeUnits((scenario.actualSalesUnits * (production[premise.id] ?? 0)) / totalProduction)
    allocation[premise.id] = amount
    allocated += amount
  })
  return allocation
}

function loanResult(
  loan: Loan | NewLoanRequest,
  isNew: boolean,
  defaultRate: number,
): LoanResult {
  const openingPrincipal = isNew ? 0 : (loan as Loan).remainingPrincipal
  const received = isNew ? (loan as NewLoanRequest).principal : 0
  const term = isNew ? (loan as NewLoanRequest).repaymentTermSeasons : (loan as Loan).remainingTermSeasons
  const rateRule = isNew ? (loan as NewLoanRequest).interestRateOverride : (loan as Loan).interestRate
  const rate = rateRule?.value ?? defaultRate
  const principalBeforeRepayment = openingPrincipal + received
  const baseRepayment = term > 0 ? Math.floor(principalBeforeRepayment / term) : 0
  const scheduled = term === 1
    ? principalBeforeRepayment
    : Math.min(principalBeforeRepayment, baseRepayment)
  const requestedExtra = isNew ? 0 : (loan as Loan).extraPrincipalRepayment
  const extra = Math.min(Math.max(0, requestedExtra), Math.max(0, principalBeforeRepayment - scheduled))
  const interest = roundShekels(principalBeforeRepayment * rate)
  const totalRepayment = scheduled + extra
  return {
    loanId: loan.id,
    isNewBorrowing: isNew,
    openingPrincipal,
    newBorrowingReceivedThisSeason: received,
    principalBeforeRepayment,
    scheduledPrincipalRepayment: scheduled,
    extraPrincipalRepayment: extra,
    totalPrincipalRepayment: totalRepayment,
    interestCalculationBase: principalBeforeRepayment,
    interestPayment: interest,
    closingPrincipal: Math.max(0, principalBeforeRepayment - totalRepayment),
  }
}

export function calculateScenario({ company, rules, scenario }: CalculationInput): ScenarioResult {
  const issues: ValidationIssue[] = []
  const blockingUnknownRules: string[] = []
  const price = ruleNumber(rules.sellingPricePerUnit, 'Selling price', blockingUnknownRules)
  const milkPrice = ruleNumber(rules.milkPricePerTon, 'Milk price', blockingUnknownRules)
  const milkYield = ruleNumber(rules.milkYieldUnitsPerTon, 'Milk yield', blockingUnknownRules)
  const minMilk = ruleNumber(rules.minimumMilkPurchaseTons, 'Minimum milk purchase', blockingUnknownRules)
  const minMarketing = ruleNumber(rules.minimumMarketInvestment, 'Minimum market investment', blockingUnknownRules)
  const salaries = ruleNumber(rules.fixedSalaries, 'Fixed salaries', blockingUnknownRules)
  const bonusRate = ruleNumber(rules.bonusRate, 'Bonus rate', blockingUnknownRules)
  const taxRate = ruleNumber(rules.taxRate, 'Tax rate', blockingUnknownRules)
  const defaultRate = ruleNumber(rules.defaultLoanInterestRate, 'Loan interest rate', blockingUnknownRules)
  const requestBlock = ruleNumber(rules.salesRequestBlockSize, 'Sales-request block size', blockingUnknownRules)

  const allProduction = scenario.actualProductionByPremise ?? scenario.plannedProductionByPremise
  const premises = selectedPremises(rules, scenario)
  const selectedSet = new Set(scenario.selectedPremiseIds)
  for (const [premiseId, amount] of Object.entries(allProduction)) {
    if (amount < 0) addIssue(issues, `negative-production-${premiseId}`, 'Negative quantities are invalid.')
    if (amount > 0 && !selectedSet.has(premiseId)) addIssue(issues, `production-unselected-${premiseId}`, 'Production cannot occur in an unselected premise.')
  }
  if ([scenario.milkPurchasedTons, scenario.salesRequestUnits, scenario.expectedSalesUnits, scenario.actualSalesUnits, scenario.marketInvestment].some((value) => value < 0)) {
    addIssue(issues, 'negative-input', 'Negative quantities are invalid.')
  }
  if (requestBlock > 0 && scenario.salesRequestUnits % requestBlock !== 0) {
    addIssue(issues, 'sales-request-block', `Sales request must be entered in ${requestBlock.toLocaleString()}-unit blocks.`, 'WARNING')
  }
  if (scenario.milkPurchasedTons < minMilk) addIssue(issues, 'minimum-milk', 'Milk purchased is below the required minimum.', 'WARNING')
  if (scenario.marketInvestment < minMarketing) addIssue(issues, 'minimum-marketing', 'Market investment is below the required minimum.', 'WARNING')
  if (scenario.newLoans.some((loan) => loan.repaymentTermSeasons <= 0)) addIssue(issues, 'loan-term', 'A loan repayment term must be at least one season.')

  const productionByPremise: Record<string, number> = Object.fromEntries(premises.map((premise) => [premise.id, allProduction[premise.id] ?? 0]))
  const totalProduction = sum(Object.values(productionByPremise))
  const totalMilkCapacity = scenario.milkPurchasedTons * milkYield
  if (totalProduction > totalMilkCapacity) addIssue(issues, 'milk-capacity', 'Production exceeds milk-derived production capacity.')
  if (scenario.actualSalesUnits > totalProduction) addIssue(issues, 'sales-production', 'Actual sales cannot exceed units available for sale.')

  const assignment = scenario.ownedMachineAssignments
  for (const [machineId, premiseId] of Object.entries(assignment)) {
    if (premiseId !== null && !selectedSet.has(premiseId)) addIssue(issues, `machine-unselected-${machineId}`, 'A machine cannot be installed in an unselected premise.')
  }
  for (const purchase of scenario.newMachinePurchases) {
    if (purchase.installedPremiseId !== null && !selectedSet.has(purchase.installedPremiseId)) addIssue(issues, `new-machine-unselected-${purchase.id}`, 'A machine cannot be installed in an unselected premise.')
  }

  const machineResults: MachineResult[] = []
  const machineCapacityByPremise: Record<string, number> = Object.fromEntries(premises.map((premise) => [premise.id, 0]))
  const machineCountByPremise: Record<string, number> = Object.fromEntries(premises.map((premise) => [premise.id, 0]))

  const idleTreatment = rules.idleMachineCostTreatment.value ?? 'MAINTENANCE_AND_DEPRECIATION'
  if (rules.idleMachineCostTreatment.status === 'UNKNOWN') blockingUnknownRules.push('Idle machine cost treatment')
  for (const owned of company.ownedMachines) {
    const installedPremiseId = assignment[owned.id] ?? owned.installedPremiseId
    const active = owned.operatingStatus === 'ACTIVE' && installedPremiseId !== null && selectedSet.has(installedPremiseId)
    const maintenance = ruleNumber(owned.maintenanceCost, `Maintenance for ${owned.id}`, blockingUnknownRules)
    const depreciation = ruleNumber(owned.seasonalDepreciation, `Depreciation for ${owned.id}`, blockingUnknownRules)
    const capacity = ruleNumber(owned.capacity, `Capacity for ${owned.id}`, blockingUnknownRules)
    const openingNbv = owned.currentNetBookValue ?? 0
    const openingLife = owned.remainingUsefulLife ?? 0
    const idleMaintenance = idleTreatment === 'MAINTENANCE_AND_DEPRECIATION' ? maintenance : 0
    const idleDepreciation = idleTreatment === 'NO_IDLE_COST' ? 0 : depreciation
    machineResults.push({
      machineId: owned.id,
      machineTypeName: owned.machineTypeName,
      operatingStatus: active ? 'ACTIVE' : 'IDLE',
      openingNetBookValue: openingNbv,
      depreciationExpense: roundShekels(active ? depreciation : idleDepreciation),
      closingNetBookValue: Math.max(0, openingNbv - roundShekels(active ? depreciation : idleDepreciation)),
      openingRemainingUsefulLife: openingLife,
      closingRemainingUsefulLife: Math.max(0, openingLife - 1),
      maintenanceExpense: roundShekels(active ? maintenance : idleMaintenance),
      activeCapacity: active ? capacity : 0,
    })
    if (installedPremiseId && selectedSet.has(installedPremiseId)) {
      machineCountByPremise[installedPremiseId] += 1
      if (active) machineCapacityByPremise[installedPremiseId] += capacity
    }
  }

  for (const purchase of scenario.newMachinePurchases) {
    const definition = rules.machineDefinitions.find((machine) => machine.id === purchase.machineDefinitionId)
    if (!definition) {
      addIssue(issues, `missing-machine-type-${purchase.id}`, 'Selected machine type is not available.')
      continue
    }
    const machinePrice = ruleNumber(definition.purchasePrice, `Purchase price for ${definition.name}`, blockingUnknownRules)
    const capacity = ruleNumber(definition.capacityPerSeason, `Capacity for ${definition.name}`, blockingUnknownRules)
    const maintenance = ruleNumber(definition.maintenancePerSeason, `Maintenance for ${definition.name}`, blockingUnknownRules)
    const usefulLife = ruleNumber(definition.usefulLifeSeasons, `Useful life for ${definition.name}`, blockingUnknownRules)
    const depreciationRule = definition.depreciationRule.value
    if (definition.depreciationRule.status === 'UNKNOWN' || !depreciationRule) blockingUnknownRules.push(`Depreciation rule for ${definition.name}`)
    const depreciation = roundShekels(depreciationRule?.seasonalAmount ?? 0)
    const active = purchase.installedPremiseId !== null && selectedSet.has(purchase.installedPremiseId)
    machineResults.push({
      machineId: purchase.id,
      machineTypeName: definition.name,
      operatingStatus: active ? 'ACTIVE' : 'IDLE',
      openingNetBookValue: machinePrice,
      depreciationExpense: active ? depreciation : 0,
      closingNetBookValue: Math.max(0, machinePrice - (active ? depreciation : 0)),
      openingRemainingUsefulLife: usefulLife,
      closingRemainingUsefulLife: Math.max(0, usefulLife - (active ? 1 : 0)),
      maintenanceExpense: active ? roundShekels(maintenance) : 0,
      activeCapacity: active ? capacity : 0,
    })
    if (purchase.installedPremiseId && selectedSet.has(purchase.installedPremiseId)) {
      machineCountByPremise[purchase.installedPremiseId] += 1
      if (active) machineCapacityByPremise[purchase.installedPremiseId] += capacity
    }
  }

  for (const premise of premises) {
    const slots = ruleNumber(premise.machineSlots, `Machine slots for ${premise.name}`, blockingUnknownRules)
    if (machineCountByPremise[premise.id] > slots) addIssue(issues, `machine-slots-${premise.id}`, 'Installed machines exceed this premise’s available machine slots.')
    if (productionByPremise[premise.id] > machineCapacityByPremise[premise.id]) addIssue(issues, `machine-capacity-${premise.id}`, 'Production exceeds active installed machine capacity at this premise.')
  }

  const salesAllocation = allocateSales(scenario, premises, productionByPremise, issues)
  const premiseResults: PremiseResult[] = premises.map((premise) => {
    const rate = ruleNumber(premise.transportRatePerSoldUnit, `Transport rate for ${premise.name}`, blockingUnknownRules)
    const capacity = machineCapacityByPremise[premise.id]
    return {
      premiseId: premise.id,
      premiseName: premise.name,
      production: productionByPremise[premise.id],
      allocatedSales: salesAllocation[premise.id] ?? 0,
      transportCost: roundShekels((salesAllocation[premise.id] ?? 0) * rate),
      installedActiveMachineCapacity: capacity,
      unusedMachineCapacity: Math.max(0, capacity - productionByPremise[premise.id]),
    }
  })

  const loanResults = [
    ...company.outstandingLoans.map((loan) => loanResult(loan, false, defaultRate)),
    ...scenario.newLoans.map((loan) => loanResult(loan, true, defaultRate)),
  ]
  const revenue = roundShekels(scenario.actualSalesUnits * price)
  const milkCost = roundShekels(scenario.milkPurchasedTons * milkPrice)
  const maintenance = sum(machineResults.map((machine) => machine.maintenanceExpense))
  const depreciation = sum(machineResults.map((machine) => machine.depreciationExpense))
  const grossProfit = revenue - milkCost - maintenance - depreciation
  const transport = sum(premiseResults.map((premise) => premise.transportCost))
  const bonus = grossProfit > 0 ? roundShekels(grossProfit * bonusRate) : 0
  const premiseRent = sum(premises.map((premise) => roundShekels(ruleNumber(premise.rentPerSeason, `Rent for ${premise.name}`, blockingUnknownRules))))
  const loanInterest = sum(loanResults.map((loan) => loan.interestPayment))
  const profitBeforeTax = grossProfit - transport - roundShekels(scenario.marketInvestment) - bonus - roundShekels(salaries) - premiseRent - loanInterest
  const openingLossPool = company.unusedTaxLossCarryforward ?? 0
  const lossPoolUsed = profitBeforeTax > 0 ? Math.min(openingLossPool, profitBeforeTax) : 0
  const taxableProfit = profitBeforeTax > 0 ? profitBeforeTax - lossPoolUsed : 0
  // Taxable profit is a posted whole-shekel amount; the resulting tax line is rounded too.
  const gameTax = roundShekels(taxableProfit * taxRate)
  const closingTaxLossPool = profitBeforeTax < 0 ? openingLossPool + Math.abs(profitBeforeTax) : openingLossPool - lossPoolUsed
  const netProfit = profitBeforeTax - gameTax

  const ownedMachinePurchases = sum(company.ownedMachines
    .filter((machine) => machine.acquiredInScenarioId === scenario.id)
    .map((machine) => roundShekels(machine.originalPurchasePrice ?? 0)))
  const newMachinePurchases = sum(scenario.newMachinePurchases.map((purchase) => {
    const definition = rules.machineDefinitions.find((machine) => machine.id === purchase.machineDefinitionId)
    return definition ? roundShekels(ruleNumber(definition.purchasePrice, `Purchase price for ${definition.name}`, blockingUnknownRules)) : 0
  }))
  const machinePurchases = ownedMachinePurchases + newMachinePurchases
  const openingCash = company.startingCashForYear2 ?? 0
  const newLoanReceived = sum(loanResults.map((loan) => loan.newBorrowingReceivedThisSeason))
  const cashAvailableBeforeAdvancePayments = openingCash + newLoanReceived
  const cashBeforeMilkPayment = cashAvailableBeforeAdvancePayments - machinePurchases
  const cashBeforeMarketInvestment = cashBeforeMilkPayment - milkCost
  const cashAfterAdvancePayments = cashBeforeMarketInvestment - roundShekels(scenario.marketInvestment)
  const totalPrincipal = sum(loanResults.map((loan) => loan.totalPrincipalRepayment))
  const closingCash = cashAfterAdvancePayments + revenue - premiseRent - maintenance - transport - roundShekels(salaries) - bonus - totalPrincipal - loanInterest - gameTax
  if (cashAvailableBeforeAdvancePayments < 0) addIssue(issues, 'cash-before-machine', 'Cash is negative before machine payment.', 'WARNING')
  if (cashBeforeMilkPayment < 0) addIssue(issues, 'cash-before-milk', 'Cash is negative before milk payment.', 'WARNING')
  if (cashBeforeMarketInvestment < 0) addIssue(issues, 'cash-before-market', 'Cash is negative before market investment.', 'WARNING')
  if (closingCash < 0) addIssue(issues, 'negative-closing-cash', 'Closing cash is negative.', 'WARNING')

  return {
    premiseResults,
    machineResults,
    loanResults,
    profitAndLoss: { revenue, milkCost, maintenance, depreciation, grossProfit, transport, marketInvestment: roundShekels(scenario.marketInvestment), bonus, fixedSalaries: roundShekels(salaries), premiseRent, loanInterest, profitBeforeTax, gameTax, netProfit },
    tax: { openingTaxLossPool: openingLossPool, lossPoolUsed, taxableProfit, gameTax, closingTaxLossPool },
    cashFlow: { openingCash, newLoanReceived, cashAvailableBeforeAdvancePayments, machinePurchases, cashBeforeMilkPayment, milkPurchase: milkCost, cashBeforeMarketInvestment, marketInvestment: roundShekels(scenario.marketInvestment), cashAfterAdvancePayments, salesReceipts: revenue, premiseRent, maintenance, transport, fixedSalaries: roundShekels(salaries), bonus, loanPrincipalRepayment: totalPrincipal, loanInterest, gameTax, closingCash },
    indicators: { unitsProduced: totalProduction, unitsSold: scenario.actualSalesUnits, unsoldFinishedUnits: Math.max(0, totalProduction - scenario.actualSalesUnits), milkPurchasedTons: scenario.milkPurchasedTons, milkRequiredForProductionTons: milkYield ? totalProduction / milkYield : 0, unusedMilkEquivalentTons: milkYield ? Math.max(0, scenario.milkPurchasedTons - totalProduction / milkYield) : 0, installedMachineCapacity: sum(premiseResults.map((premise) => premise.installedActiveMachineCapacity)), unusedMachineCapacity: sum(premiseResults.map((premise) => premise.unusedMachineCapacity)) },
    validationIssues: issues,
    blockingUnknownRules: [...new Set(blockingUnknownRules)],
    requiredBorrowing: Math.max(0, -Math.min(cashAvailableBeforeAdvancePayments, cashBeforeMilkPayment, cashBeforeMarketInvestment, cashAfterAdvancePayments, closingCash)),
    closingDebt: sum(loanResults.map((loan) => loan.closingPrincipal)),
  }
}

export function createStressTestScenarios(scenario: Scenario): Scenario[] {
  return [100, 90, 80, 70, 60].map((percent) => ({
    ...scenario,
    id: scenario.id,
    name: `${scenario.name} — ${percent}% sales case`,
    // Generated actual sales are always whole ice-cream units.
    actualSalesUnits: wholeUnits((scenario.salesRequestUnits * percent) / 100),
    salesAllocationMode: 'RULE_DEFAULT',
    manualSalesAllocationByPremise: undefined,
  }))
}

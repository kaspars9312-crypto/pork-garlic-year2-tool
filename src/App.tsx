import { useMemo, useState } from "react";
import {
  calculateScenario,
  createStressTestScenarios,
} from "./calculations/scenario";
import {
  blankScenario,
  initialCompanyPosition,
  initialRules,
  resetScenario,
  rule,
} from "./data/initialState";
import {
  createYear1WinterValidationCase,
  year1Expected,
  year1ValidationMismatches,
} from "./data/year1WinterValidationCase";
import type {
  CompanyPosition,
  RuleStatus,
  Scenario,
  ScenarioResult,
  Year2Rules,
} from "./types/financial";

const money = (n: number) => `Sh ${n.toLocaleString()}`;
const statuses: RuleStatus[] = ["CONFIRMED", "ESTIMATE", "UNKNOWN"];
const estimate = (n = 0) =>
  rule(n, "ESTIMATE", "Estimate based on Year 1 — not confirmed for Year 2.");
function NumberField({
  label,
  value,
  onChange,
  step = 1,
  disabled = false,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      />
    </label>
  );
}
function RuleField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: { value: number | null; status: RuleStatus };
  onChange: (v: number | null, s: RuleStatus) => void;
  step?: number;
}) {
  return (
    <div className="rule-field">
      <NumberField
        label={label}
        value={value.value}
        step={step}
        onChange={(v) => onChange(v, value.status)}
      />
      <select
        value={value.status}
        onChange={(e) => onChange(value.value, e.target.value as RuleStatus)}
      >
        {statuses.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}
function Results({ result }: { result: ScenarioResult }) {
  const p = result.profitAndLoss;
  const pnl = [
    ["Revenue", p.revenue],
    ["Milk cost", p.milkCost],
    ["Maintenance", p.maintenance],
    ["Depreciation", p.depreciation],
    ["Gross Profit", p.grossProfit],
    ["Transport", p.transport],
    ["Market investment", p.marketInvestment],
    ["Bonus", p.bonus],
    ["Fixed salaries", p.fixedSalaries],
    ["Premise rent", p.premiseRent],
    ["Loan interest", p.loanInterest],
    ["Profit Before Tax", p.profitBeforeTax],
    ["Game Tax", p.gameTax],
    ["Net Profit", p.netProfit],
  ];
  return (
    <div className="result-grid">
      <section>
        <h4>CALCULATED — Projected Profit &amp; Loss</h4>
        <dl>
          {pnl.map(([l, v]) => (
            <div
              className={
                ["Gross Profit", "Profit Before Tax", "Net Profit"].includes(
                  l as string,
                )
                  ? "total"
                  : ""
              }
              key={l as string}
            >
              <dt>{l}</dt>
              <dd>{money(v as number)}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h4>CALCULATED — Cash &amp; Operations</h4>
        <dl>
          {[
            ["Opening cash", result.cashFlow.openingCash],
            ["New loan received", result.cashFlow.newLoanReceived],
            ["Machine purchases", result.cashFlow.machinePurchases],
            [
              "Cash after advance payments",
              result.cashFlow.cashAfterAdvancePayments,
            ],
            ["Closing cash", result.cashFlow.closingCash],
            ["Closing debt", result.closingDebt],
            ["Required borrowing", result.requiredBorrowing],
          ].map(([l, v]) => (
            <div key={l as string}>
              <dt>{l}</dt>
              <dd>{money(v as number)}</dd>
            </div>
          ))}
        </dl>
        <p>
          Units produced / sold:{" "}
          {result.indicators.unitsProduced.toLocaleString()} /{" "}
          {result.indicators.unitsSold.toLocaleString()}
        </p>
        <p>
          Unsold production:{" "}
          {result.indicators.unsoldFinishedUnits.toLocaleString()}
        </p>
        <p>
          Unused capacity:{" "}
          {result.indicators.unusedMachineCapacity.toLocaleString()}
        </p>
      </section>
      <section>
        <h4>CALCULATED — Tax-loss carryforward</h4>
        <dl>
          {[
            ["Opening tax loss pool", result.tax.openingTaxLossPool],
            ["Profit Before Tax", result.profitAndLoss.profitBeforeTax],
            ["Loss pool used", result.tax.lossPoolUsed],
            ["Taxable profit", result.tax.taxableProfit],
            ["Game Tax", result.tax.gameTax],
            ["Closing tax loss pool", result.tax.closingTaxLossPool],
          ].map(([label, value]) => (
            <div key={label as string}>
              <dt>{label}</dt>
              <dd>{money(value as number)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
function ScenarioCard({
  scenario,
  company,
  rules,
  set,
  onReset,
}: {
  scenario: Scenario;
  company: CompanyPosition;
  rules: Year2Rules;
  set: (s: Scenario) => void;
  onReset: () => void;
}) {
  const result = useMemo(
    () => calculateScenario({ company, rules, scenario }),
    [company, rules, scenario],
  );
  // This is deliberately sourced only from the shared Year 2 catalog.
  // Scenario state controls selection and production, never row visibility.
  const premiseDefinitions = rules.premiseDefinitions;
  const update = (patch: Partial<Scenario>) => set({ ...scenario, ...patch });
  const togglePremise = (premiseId: string) => {
    const isSelected = scenario.selectedPremiseIds.includes(premiseId);
    if (!isSelected) {
      update({ selectedPremiseIds: [...scenario.selectedPremiseIds, premiseId] });
      return;
    }

    update({
      selectedPremiseIds: scenario.selectedPremiseIds.filter(
        (id) => id !== premiseId,
      ),
      plannedProductionByPremise: {
        ...scenario.plannedProductionByPremise,
        [premiseId]: 0,
      },
      ownedMachineAssignments: Object.fromEntries(
        Object.entries(scenario.ownedMachineAssignments).map(
          ([machineId, assignedPremiseId]) => [
            machineId,
            assignedPremiseId === premiseId ? null : assignedPremiseId,
          ],
        ),
      ),
      newMachinePurchases: scenario.newMachinePurchases.map((purchase) =>
        purchase.installedPremiseId === premiseId
          ? { ...purchase, installedPremiseId: null }
          : purchase,
      ),
    });
  };
  return (
    <article className="scenario-panel">
      <div className="panel-heading">
        <h3>{scenario.name}</h3>
        <button className="text-button" onClick={onReset}>
          Reset scenario
        </button>
      </div>
      <div className="input-grid">
        <NumberField
          label="Milk purchased (tons)"
          value={scenario.milkPurchasedTons}
          step={0.1}
          onChange={(v) => update({ milkPurchasedTons: v ?? 0 })}
        />
        <NumberField
          label="Sales request"
          value={scenario.salesRequestUnits}
          onChange={(v) => update({ salesRequestUnits: v ?? 0 })}
        />
        <NumberField
          label="Expected sales"
          value={scenario.expectedSalesUnits}
          onChange={(v) => update({ expectedSalesUnits: v ?? 0 })}
        />
        <NumberField
          label="Actual sales"
          value={scenario.actualSalesUnits}
          onChange={(v) => update({ actualSalesUnits: v ?? 0 })}
        />
        <NumberField
          label="Market investment"
          value={scenario.marketInvestment}
          onChange={(v) => update({ marketInvestment: v ?? 0 })}
        />
      </div>
      <h4>Premise, machine and production plan</h4>
      {premiseDefinitions.map((p) => {
        const isSelected = scenario.selectedPremiseIds.includes(p.id);
        return (
        <div className="premise-line" key={p.id}>
          <label>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => togglePremise(p.id)}
            />{" "}
            Select / rent {p.name}
          </label>
          <span className="muted">
            Slots {p.machineSlots.value ?? "Unknown"} · Rent {money(p.rentPerSeason.value ?? 0)} · Transport {p.transportRatePerSoldUnit.value ?? "Unknown"}
          </span>
          <NumberField
            label="Production"
            value={scenario.plannedProductionByPremise[p.id] ?? 0}
            disabled={!isSelected}
            onChange={(v) =>
              update({
                plannedProductionByPremise: {
                  ...scenario.plannedProductionByPremise,
                  [p.id]: v ?? 0,
                },
              })
            }
          />
        </div>
        );
      })}
      {company.ownedMachines.map((m) => (
        <label className="field" key={m.id}>
          Assign {m.machineTypeName}
          <select
            value={scenario.ownedMachineAssignments[m.id] ?? ""}
            onChange={(e) =>
              update({
                ownedMachineAssignments: {
                  ...scenario.ownedMachineAssignments,
                  [m.id]: e.target.value || null,
                },
              })
            }
          >
            <option value="">Uninstalled</option>
            {scenario.selectedPremiseIds.map((id) => (
              <option key={id} value={id}>
                {rules.premiseDefinitions.find((p) => p.id === id)?.name}
              </option>
            ))}
          </select>
        </label>
      ))}
      <div className="editor-heading">
        <strong>New machines and borrowing</strong>
        <button
          disabled={!rules.machineDefinitions.length}
          onClick={() =>
            rules.machineDefinitions[0] &&
            update({
              newMachinePurchases: [
                ...scenario.newMachinePurchases,
                {
                  id: `buy-${Date.now()}`,
                  machineDefinitionId: rules.machineDefinitions[0].id,
                  installedPremiseId: scenario.selectedPremiseIds[0] ?? null,
                },
              ],
            })
          }
        >
          Buy new machine
        </button>
        <button
          onClick={() =>
            update({
              newLoans: [
                ...scenario.newLoans,
                {
                  id: `loan-${Date.now()}`,
                  principal: 0,
                  repaymentTermSeasons: 1,
                },
              ],
            })
          }
        >
          Add borrowing
        </button>
      </div>
      {scenario.newLoans.map((loan, i) => (
        <div className="editor-grid" key={loan.id}>
          <NumberField
            label="Loan amount"
            value={loan.principal}
            onChange={(v) =>
              update({
                newLoans: scenario.newLoans.map((x, n) =>
                  n === i ? { ...x, principal: v ?? 0 } : x,
                ),
              })
            }
          />
          <NumberField
            label="Repayment term"
            value={loan.repaymentTermSeasons}
            onChange={(v) =>
              update({
                newLoans: scenario.newLoans.map((x, n) =>
                  n === i ? { ...x, repaymentTermSeasons: v ?? 0 } : x,
                ),
              })
            }
          />
          <NumberField
            label="Interest override"
            value={loan.interestRateOverride?.value ?? null}
            step={0.01}
            onChange={(v) =>
              update({
                newLoans: scenario.newLoans.map((x, n) =>
                  n === i
                    ? {
                        ...x,
                        interestRateOverride:
                          v === null ? undefined : estimate(v),
                      }
                    : x,
                ),
              })
            }
          />
        </div>
      ))}
      {result.validationIssues.map((i) => (
        <p className={i.severity === "ERROR" ? "error" : "warning"} key={i.id}>
          {i.message}
        </p>
      ))}
      <Results result={result} />
      <table>
        <thead>
          <tr>
            <th>Premise</th>
            <th>Production</th>
            <th>Allocated sales</th>
            <th>Transport</th>
            <th>Unused capacity</th>
          </tr>
        </thead>
        <tbody>
          {result.premiseResults.map((p) => (
            <tr key={p.premiseId}>
              <td>{p.premiseName}</td>
              <td>{p.production}</td>
              <td>{p.allocatedSales}</td>
              <td>{money(p.transportCost)}</td>
              <td>{p.unusedMachineCapacity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
function App() {
  const [company, setCompany] = useState<CompanyPosition>(
    initialCompanyPosition,
  );
  const [rules, setRules] = useState<Year2Rules>(initialRules);
  const [a, setA] = useState(blankScenario("A"));
  const [b, setB] = useState(blankScenario("B"));
  const [rec, setRec] = useState("NEITHER");
  const [assumption, setAssumption] = useState("");
  const [validation, setValidation] = useState<ReturnType<
    typeof createYear1WinterValidationCase
  > | null>(null);
  const va = validation ? calculateScenario(validation) : null;
  const mismatch = va ? year1ValidationMismatches(va) : [];
  const updateRule = (
    key: keyof Pick<
      Year2Rules,
      | "sellingPricePerUnit"
      | "milkPricePerTon"
      | "milkYieldUnitsPerTon"
      | "minimumMilkPurchaseTons"
      | "minimumMarketInvestment"
      | "fixedSalaries"
      | "bonusRate"
      | "taxRate"
      | "defaultLoanInterestRate"
    >,
    v: number | null,
    s: RuleStatus,
  ) => setRules({ ...rules, [key]: { ...rules[key], value: v, status: s } });
  const addPremise = () =>
    setRules({
      ...rules,
      premiseDefinitions: [
        ...rules.premiseDefinitions,
        {
          id: `premise-${Date.now()}`,
          name: "Estimated premise",
          availabilityStatus: "ESTIMATE",
          machineSlots: estimate(),
          rentPerSeason: estimate(),
          transportRatePerSoldUnit: estimate(),
        },
      ],
    });
  const addType = () =>
    setRules({
      ...rules,
      machineDefinitions: [
        ...rules.machineDefinitions,
        {
          id: `type-${Date.now()}`,
          name: "Estimated machine type",
          availabilityStatus: "ESTIMATE",
          purchasePrice: estimate(),
          capacityPerSeason: estimate(),
          maintenancePerSeason: estimate(),
          usefulLifeSeasons: estimate(1),
          depreciationRule: rule(
            {
              method: "SEASONAL_FIXED_AMOUNT",
              seasonalAmount: 0,
              description: "Estimate",
            },
            "ESTIMATE",
          ),
        },
      ],
    });
  const updatePremise = (
    index: number,
    patch: Partial<Year2Rules['premiseDefinitions'][number]>,
  ) =>
    setRules({
      ...rules,
      premiseDefinitions: rules.premiseDefinitions.map((premise, itemIndex) =>
        itemIndex === index ? { ...premise, ...patch } : premise,
      ),
    });
  const removePremise = (index: number) =>
    setRules({
      ...rules,
      premiseDefinitions: rules.premiseDefinitions.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    });
  const updateMachineType = (
    index: number,
    patch: Partial<Year2Rules['machineDefinitions'][number]>,
  ) =>
    setRules({
      ...rules,
      machineDefinitions: rules.machineDefinitions.map((machine, itemIndex) =>
        itemIndex === index ? { ...machine, ...patch } : machine,
      ),
    });
  const removeMachineType = (index: number) =>
    setRules({
      ...rules,
      machineDefinitions: rules.machineDefinitions.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    });
  const addOwned = () =>
    setCompany({
      ...company,
      ownedMachines: [
        ...company.ownedMachines,
        {
          id: `owned-${Date.now()}`,
          machineDefinitionId: null,
          machineTypeName: "Owned machine",
          originalPurchasePrice: 0,
          currentNetBookValue: 0,
          remainingUsefulLife: 1,
          seasonalDepreciation: estimate(),
          maintenanceCost: estimate(),
          capacity: estimate(),
          installedPremiseId: null,
          operatingStatus: "ACTIVE",
          acquiredInScenarioId: null,
        },
      ],
    });
  const addExistingLoan = () =>
    setCompany({
      ...company,
      outstandingLoans: [
        ...company.outstandingLoans,
        {
          id: `existing-${Date.now()}`,
          label: "Outstanding loan",
          originalPrincipal: 0,
          remainingPrincipal: 0,
          borrowingSeason: "Year 1",
          remainingTermSeasons: 1,
          interestRate: estimate(),
          extraPrincipalRepayment: 0,
        },
      ],
    });
  const stress = createStressTestScenarios(a).map((s) => ({
    s,
    r: calculateScenario({ company, rules, scenario: s }),
  }));
  const resultA = calculateScenario({ company, rules, scenario: a });
  const resultB = calculateScenario({ company, rules, scenario: b });
  const financialDifferences = [
    ["Revenue", resultA.profitAndLoss.revenue, resultB.profitAndLoss.revenue],
    ["Net Profit", resultA.profitAndLoss.netProfit, resultB.profitAndLoss.netProfit],
    ["Closing Cash", resultA.cashFlow.closingCash, resultB.cashFlow.closingCash],
    ["Machine purchases", resultA.cashFlow.machinePurchases, resultB.cashFlow.machinePurchases],
    ["Market investment", resultA.profitAndLoss.marketInvestment, resultB.profitAndLoss.marketInvestment],
    ["Premise rent", resultA.profitAndLoss.premiseRent, resultB.profitAndLoss.premiseRent],
    ["Transport", resultA.profitAndLoss.transport, resultB.profitAndLoss.transport],
    ["Maintenance", resultA.profitAndLoss.maintenance, resultB.profitAndLoss.maintenance],
    ["Loan interest", resultA.profitAndLoss.loanInterest, resultB.profitAndLoss.loanInterest],
    ["Closing debt", resultA.closingDebt, resultB.closingDebt],
    ["Unsold production", resultA.indicators.unsoldFinishedUnits, resultB.indicators.unsoldFinishedUnits],
    ["Unused milk", resultA.indicators.unusedMilkEquivalentTons, resultB.indicators.unusedMilkEquivalentTons],
    ["Unused machine capacity", resultA.indicators.unusedMachineCapacity, resultB.indicators.unusedMachineCapacity],
  ].filter(([, left, right]) => left !== right) as [string, number, number][];
  return (
    <main className="app-shell">
      <header>
        <p className="eyebrow">University decision support dashboard</p>
        <h1>Pork &amp; Garlic Ice Cream Co. — Year 2 Decision Tool</h1>
        <button
          onClick={() => {
            setCompany(initialCompanyPosition);
            setRules(initialRules);
            setA(blankScenario("A"));
            setB(blankScenario("B"));
            setValidation(null);
          }}
        >
          Reset all
        </button>
      </header>
      <section className="notice">
        Provisional until Year 1 Autumn is completed. 410,000 units is a total
        market forecast, not guaranteed company sales.
      </section>
      <section>
        <h2>1. Year 1 Closing Position</h2>
        <NumberField
          label="Starting cash for Year 2"
          value={company.startingCashForYear2}
          onChange={(v) => setCompany({ ...company, startingCashForYear2: v })}
        />
        <div className="input-grid">
          <NumberField
            label="Unused tax loss carryforward"
            value={company.unusedTaxLossCarryforward}
            onChange={(v) =>
              setCompany({ ...company, unusedTaxLossCarryforward: v })
            }
          />
          <NumberField
            label="Year 1 annual profit"
            value={company.year1AnnualProfit}
            onChange={(v) => setCompany({ ...company, year1AnnualProfit: v })}
          />
        </div>
        <div className="editor-heading">
          <button onClick={addOwned}>Add owned machine</button>
          <button onClick={addExistingLoan}>Add outstanding loan</button>
        </div>
        {company.ownedMachines.map((m, i) => (
          <div className="editor-card" key={m.id}>
            {m.machineTypeName} · NBV {money(m.currentNetBookValue ?? 0)} · Life{" "}
            {m.remainingUsefulLife} · Capacity {m.capacity.value}
          </div>
        ))}
        {company.outstandingLoans.map((l) => (
          <div className="editor-card" key={l.id}>
            {l.label} · Principal {money(l.remainingPrincipal)} · Term{" "}
            {l.remainingTermSeasons} · Rate {l.interestRate.value}
          </div>
        ))}
      </section>
      <section>
        <h2>2. Year 2 Assumptions</h2>
        <div className="rules-grid">
          {(
            [
              ["sellingPricePerUnit", "Selling price"],
              ["milkPricePerTon", "Milk price per ton"],
              ["milkYieldUnitsPerTon", "Milk yield"],
              ["minimumMilkPurchaseTons", "Minimum milk purchase"],
              ["minimumMarketInvestment", "Minimum market investment"],
              ["fixedSalaries", "Fixed salaries"],
              ["bonusRate", "Bonus rate"],
              ["taxRate", "Tax rate"],
              ["defaultLoanInterestRate", "Loan interest rate"],
            ] as const
          ).map(([k, l]) => (
            <RuleField
              key={k}
              label={l}
              value={rules[k]}
              step={k.includes("Rate") ? 0.01 : 1}
              onChange={(v, s) => updateRule(k, v, s)}
            />
          ))}
        </div>
        <div className="editor-heading">
          <button onClick={addPremise}>Add premise</button>
          <button onClick={addType}>Add machine type</button>
        </div>
        {rules.premiseDefinitions.map((p, index) => (
          <div className="editor-card" key={p.id}>
            <div className="editor-grid">
              <label>
                Premise name / ID
                <input
                  value={p.name}
                  onChange={(event) =>
                    updatePremise(index, { name: event.target.value })
                  }
                />
              </label>
              <label>
                Premise ID
                <input
                  value={p.id}
                  onChange={(event) =>
                    updatePremise(index, { id: event.target.value })
                  }
                />
              </label>
              <NumberField
                label="Machine slots"
                value={p.machineSlots.value}
                onChange={(value) =>
                  updatePremise(index, {
                    machineSlots: { ...p.machineSlots, value },
                  })
                }
              />
              <NumberField
                label="Rent per season"
                value={p.rentPerSeason.value}
                onChange={(value) =>
                  updatePremise(index, {
                    rentPerSeason: { ...p.rentPerSeason, value },
                  })
                }
              />
              <NumberField
                label="Transport rate per sold unit"
                value={p.transportRatePerSoldUnit.value}
                step={0.01}
                onChange={(value) =>
                  updatePremise(index, {
                    transportRatePerSoldUnit: {
                      ...p.transportRatePerSoldUnit,
                      value,
                    },
                  })
                }
              />
              <label>
                Rule status
                <select
                  value={p.availabilityStatus}
                  onChange={(event) =>
                    updatePremise(index, {
                      availabilityStatus: event.target.value as RuleStatus,
                    })
                  }
                >
                  {statuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
            </div>
            <button className="danger" onClick={() => removePremise(index)}>
              Remove premise
            </button>
          </div>
        ))}
        {rules.machineDefinitions.map((m, index) => (
          <div className="editor-card" key={m.id}>
            <div className="editor-grid">
              <label>
                Machine name
                <input
                  value={m.name}
                  onChange={(event) =>
                    updateMachineType(index, { name: event.target.value })
                  }
                />
              </label>
              <label>
                Machine ID
                <input
                  value={m.id}
                  onChange={(event) =>
                    updateMachineType(index, { id: event.target.value })
                  }
                />
              </label>
              <NumberField
                label="Capacity per season"
                value={m.capacityPerSeason.value}
                onChange={(value) =>
                  updateMachineType(index, {
                    capacityPerSeason: { ...m.capacityPerSeason, value },
                  })
                }
              />
              <NumberField
                label="Purchase price"
                value={m.purchasePrice.value}
                onChange={(value) =>
                  updateMachineType(index, {
                    purchasePrice: { ...m.purchasePrice, value },
                  })
                }
              />
              <NumberField
                label="Maintenance per season"
                value={m.maintenancePerSeason.value}
                onChange={(value) =>
                  updateMachineType(index, {
                    maintenancePerSeason: {
                      ...m.maintenancePerSeason,
                      value,
                    },
                  })
                }
              />
              <NumberField
                label="Depreciation life (seasons)"
                value={m.usefulLifeSeasons.value}
                onChange={(value) =>
                  updateMachineType(index, {
                    usefulLifeSeasons: { ...m.usefulLifeSeasons, value },
                  })
                }
              />
              <label>
                Rule status
                <select
                  value={m.availabilityStatus}
                  onChange={(event) =>
                    updateMachineType(index, {
                      availabilityStatus: event.target.value as RuleStatus,
                    })
                  }
                >
                  {statuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="danger"
              onClick={() => removeMachineType(index)}
            >
              Remove machine type
            </button>
          </div>
        ))}
      </section>
      <section className="scenario-grid">
        <div>
          <h2>3. Scenario A</h2>
          <ScenarioCard
            scenario={a}
            company={company}
            rules={rules}
            set={setA}
            onReset={() => setA(resetScenario("A", rules))}
          />
        </div>
        <div>
          <h2>4. Scenario B</h2>
          <ScenarioCard
            scenario={b}
            company={company}
            rules={rules}
            set={setB}
            onReset={() => setB(resetScenario("B", rules))}
          />
        </div>
      </section>
      <section>
        <h2>5–6. Scenario Results &amp; Comparison</h2>
        <p>
          Scenario A net profit{" "}
          {money(
            calculateScenario({ company, rules, scenario: a }).profitAndLoss
              .netProfit,
          )}
          ; closing cash{" "}
          {money(
            calculateScenario({ company, rules, scenario: a }).cashFlow
              .closingCash,
          )}
          .
        </p>
        <p>
          Scenario B net profit{" "}
          {money(
            calculateScenario({ company, rules, scenario: b }).profitAndLoss
              .netProfit,
          )}
          ; closing cash{" "}
          {money(
            calculateScenario({ company, rules, scenario: b }).cashFlow
              .closingCash,
          )}
          .
        </p>
        <h3>Key financial differences</h3>
        {financialDifferences.length === 0 ? (
          <p className="muted">The calculated comparison measures are currently equal.</p>
        ) : (
          <ul>
            {financialDifferences.map(([label, valueA, valueB]) => {
              const higherScenario = valueA > valueB ? "Scenario A" : "Scenario B";
              const lowerScenario = valueA > valueB ? "Scenario B" : "Scenario A";
              const difference = Math.abs(valueA - valueB);
              const unitLabels = ["Unsold production", "Unused machine capacity"];
              const isUnits = unitLabels.includes(label);
              const suffix = isUnits ? " units" : label === "Unused milk" ? " tons" : "";
              const amount = isUnits || label === "Unused milk"
                ? `${difference.toLocaleString()}${suffix}`
                : money(difference);
              return (
                <li key={label}>
                  {higherScenario} has {amount} higher {label.toLowerCase()} than {lowerScenario}.
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section>
        <h2>7. Stress Test</h2>
        <table>
          <thead>
            <tr>
              <th>Case</th>
              <th>Actual sales</th>
              <th>Revenue</th>
              <th>Net profit</th>
              <th>Closing cash</th>
              <th>Unsold production</th>
              <th>Funding warning</th>
            </tr>
          </thead>
          <tbody>
            {stress.map(({ s, r }) => (
              <tr key={s.name}>
                <td>{s.name}</td>
                <td>{s.actualSalesUnits}</td>
                <td>{money(r.profitAndLoss.revenue)}</td>
                <td>{money(r.profitAndLoss.netProfit)}</td>
                <td>{money(r.cashFlow.closingCash)}</td>
                <td>{r.indicators.unsoldFinishedUnits}</td>
                <td>
                  {r.requiredBorrowing ? money(r.requiredBorrowing) : "None"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2>8. Recommendation</h2>
        <label>
          <input
            type="radio"
            checked={rec === "A"}
            onChange={() => setRec("A")}
          />{" "}
          Scenario A
        </label>
        <label>
          <input
            type="radio"
            checked={rec === "B"}
            onChange={() => setRec("B")}
          />{" "}
          Scenario B
        </label>
        <label>
          <input
            type="radio"
            checked={rec === "NEITHER"}
            onChange={() => setRec("NEITHER")}
          />{" "}
          Neither / revise plan
        </label>
        <input
          value={assumption}
          placeholder="Most important assumption"
          onChange={(e) => setAssumption(e.target.value)}
        />
      </section>
      <section>
        <h2>9. Year 1 Validation</h2>
        <p>
          Dedicated historical state: never modifies Year 2 closing position,
          Scenario A, or Scenario B.
        </p>
        <button
          onClick={() => setValidation(createYear1WinterValidationCase())}
        >
          Load Year 1 Winter Validation Case
        </button>
        {va && (
          <div
            className={mismatch.length ? "validation fail" : "validation pass"}
          >
            <strong>{mismatch.length ? "FAIL" : "PASS"}</strong>
            <span>
              {mismatch.length
                ? mismatch.join(" • ")
                : `Expected and calculated values match. Closing Cash ${money(year1Expected.closingCash)}. Balance Check 0.`}
            </span>
          </div>
        )}
      </section>
    </main>
  );
}
export default App;

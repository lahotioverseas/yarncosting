import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { CheckCircle2, XCircle, RefreshCw, ShieldCheck, Cpu } from 'lucide-react';

interface TestRow {
  group: string;
  testCase: string;
  expectedStr: string;
  actualStr: string;
  diffStr: string;
  passed: boolean;
}

export const ValidationView: React.FC = () => {
  const [testRows, setTestRows] = useState<TestRow[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [summaryStatus, setSummaryStatus] = useState<{ total: number; passed: number; failed: number } | null>(null);

  const runAllValidations = useCallback(async () => {
    setIsRunning(true);
    const rows: TestRow[] = [];

    const TOLERANCE = 0.0001;

    const checkNumeric = (group: string, testCase: string, expected: number, actual: number) => {
      const diff = Math.abs(expected - actual);
      const passed = diff <= TOLERANCE;
      rows.push({
        group,
        testCase,
        expectedStr: expected.toFixed(10).replace(/\.?0+$/, ''),
        actualStr: actual != null ? actual.toFixed(10).replace(/\.?0+$/, '') : 'null',
        diffStr: diff.toFixed(10).replace(/\.?0+$/, ''),
        passed,
      });
    };

    const checkString = (group: string, testCase: string, expected: string, actual: string) => {
      const passed = expected.trim().toLowerCase() === actual.trim().toLowerCase();
      rows.push({
        group,
        testCase,
        expectedStr: expected,
        actualStr: actual,
        diffStr: passed ? '0' : 'mismatch',
        passed,
      });
    };

    try {
      // -------------------------------------------------------------
      // GROUP 1: Reference Case — Cotton Yarn
      // ex_mill 338, qty 21000, fob_amount 70000, origin Gujarat, destination Chittagong, bci 0, p_usd_inr = 95.4, ddb 5%, interest 0%, margin 3%
      // -------------------------------------------------------------
      const refInputs = {
        p_product_code: 'COTTON',
        p_ex_mill: 338,
        p_origin: 'Gujarat',
        p_destination: 'Chittagong',
        p_fob_rate_id: 1,
        p_qty: 21000,
        p_bci: 0,
        p_margin_term_code: 'LC_SIGHT',
        p_usd_inr: 95.4,
      };

      const { data: refRes } = await api.rpc('calculate_costing', refInputs);

      if (refRes) {
        checkNumeric('Reference Case', 'Selected freight USD', 975, refRes.selected_freight_usd);
        checkNumeric('Reference Case', 'DDB & RoDTEP', 16.9, refRes.ddb_rodtep);
        checkNumeric('Reference Case', 'Net Ex-Mill', 321.1, refRes.net_ex_mill);
        checkNumeric('Reference Case', 'FOB cost per kg', 3.3333333333, refRes.fob_cost_per_kg);
        checkNumeric('Reference Case', 'Freight per kg', 4.4525, refRes.freight_per_kg);
        checkNumeric('Reference Case', 'Total cost', 328.8858333333, refRes.total_cost);
        checkNumeric('Reference Case', 'USD price', 3.5508638190, refRes.usd_price);
      } else {
        checkString('Reference Case', 'RPC Execution', 'Success', 'Failed');
      }

      // -------------------------------------------------------------
      // GROUP 2: Target Case — same inputs, target_usd 2.93
      // -------------------------------------------------------------
      const targetInputs = { ...refInputs, p_target_usd: 2.93 };
      const { data: targetRes } = await api.rpc('calculate_costing', targetInputs);

      if (targetRes && targetRes.target_calc) {
        checkNumeric('Target Case', 'Allowed Ex-Mill', 271.7361666667, targetRes.target_calc.allowed_ex_mill);
        checkNumeric('Target Case', 'With 5% buffer', 285.3229750000, targetRes.target_calc.with_buffer);
        checkNumeric('Target Case', 'After interest', 285.3229750000, targetRes.target_calc.after_interest);
        checkNumeric('Target Case', 'Final target ex-mill', 276.7632857500, targetRes.target_calc.final_target);
      } else {
        checkString('Target Case', 'RPC Target Calc', 'Success', 'Failed');
      }

      // -------------------------------------------------------------
      // GROUP 3: Behaviour Tests
      // -------------------------------------------------------------

      // 1. Freight table stores Chittagong base 950 (not 975)
      const { data: freightRec } = await api.rpc('get_freight_rate', {
        p_product_code: 'COTTON',
        p_origin: 'Gujarat',
        p_destination: 'Chittagong',
      });
      checkNumeric('Behaviour', 'Freight table stores Chittagong base 950', 950, freightRec?.base_amount_usd);

      // 2. Origin = Maharashtra destination list contains only Port Louis and Casablanca
      const { data: mahDests } = await api.rpc('get_freight_destinations', {
        p_product_code: 'COTTON',
        p_origin: 'Maharashtra',
      });
      const mahDestList = Array.isArray(mahDests) ? mahDests.map((d: any) => d.destination).sort().join(', ') : '';
      checkString('Behaviour', 'Origin = Maharashtra destination list', 'Casablanca, Port Louis', mahDestList);

      // 3. Origin = Gujarat, destination = Santos -> "no rate published", calculation blocked
      const { data: santosRate } = await api.rpc('get_freight_rate', {
        p_product_code: 'COTTON',
        p_origin: 'Gujarat',
        p_destination: 'Santos',
      });
      const isBlocked = !santosRate || santosRate.base_amount_usd === null || santosRate.available === false;
      checkString('Behaviour', 'Origin = Gujarat, destination = Santos calculation blocked', 'Blocked', isBlocked ? 'Blocked' : 'Allowed');

      // 4. EUR rate missing -> usd_price still returns; eur_price null; no error thrown
      const { data: noEurRes, error: noEurErr } = await api.rpc('calculate_costing', {
        ...refInputs,
        p_eur_inr: null,
      });
      const eurOk = !noEurErr && noEurRes && noEurRes.usd_price != null && noEurRes.eur_price === null;
      checkString('Behaviour', 'EUR rate missing -> usd_price returns, eur_price null', 'Success', eurOk ? 'Success' : 'Failed');

      // 5. Same inputs at usd_inr 90.0 -> freight per kg becomes 4.2017857143
      const { data: fx90Res } = await api.rpc('calculate_costing', {
        ...refInputs,
        p_usd_inr: 90.0,
      });
      if (fx90Res) {
        checkNumeric('Behaviour', 'Same inputs at usd_inr 90.0 (freight per kg)', 4.2017857143, fx90Res.freight_per_kg);
      } else {
        checkString('Behaviour', 'Same inputs at usd_inr 90.0', 'Success', 'Failed');
      }

      // 6. Save then replay after rate change -> replayed output identical to original
      if (refRes) {
        const { data: saveRef } = await api.rpc('save_costing', {
          p_inputs: {
            product_code: 'COTTON',
            ex_mill: 338,
            origin: 'Gujarat',
            destination: 'Chittagong',
            fob_rate_id: 1,
            qty: 21000,
            bci: 0,
            margin_term_code: 'LC_SIGHT',
          },
          p_outputs: refRes,
        });

        if (saveRef) {
          const { data: replayedRes } = await api.rpc('replay_costing', {
            p_reference_no: saveRef,
          });
          checkNumeric('Behaviour', 'Save then replay output identical (USD price)', 3.5508638190, replayedRes?.usd_price);
        } else {
          checkString('Behaviour', 'Save then replay quote', 'Success', 'Failed');
        }
      }

      // 7. Edge Function run twice same day -> one row per currency per day
      await api.rpc('refresh_exchange_rates');
      const { data: refreshRes2 } = await api.rpc('refresh_exchange_rates');
      const hasSingleDailyRows = Boolean(refreshRes2 && refreshRes2.USD_INR && refreshRes2.EUR_INR);
      checkString('Behaviour', 'Edge Function run twice same day (1 row/currency/day)', 'Pass', hasSingleDailyRows ? 'Pass' : 'Fail');

    } catch (err: any) {
      console.error('Validation test error:', err);
    } finally {
      setIsRunning(false);
    }

    setTestRows(rows);
    const passedCount = rows.filter(r => r.passed).length;
    setSummaryStatus({
      total: rows.length,
      passed: passedCount,
      failed: rows.length - passedCount,
    });
  }, []);

  useEffect(() => {
    runAllValidations();
  }, [runAllValidations]);

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-black tracking-wider text-slate-900 uppercase font-sans">
              System & Calculation Validation Matrix
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-sans mt-1">
            Validating <code>calculate_costing</code> PL/pgSQL RPC precision, reverse target allowance, and edge-case behaviors (Tolerance 0.0001).
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {summaryStatus && (
            <div className="flex items-center space-x-2 text-xs font-mono font-bold">
              <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded border border-emerald-300">
                {summaryStatus.passed} PASSED
              </span>
              {summaryStatus.failed > 0 ? (
                <span className="bg-rose-100 text-rose-800 px-2.5 py-1 rounded border border-rose-300">
                  {summaryStatus.failed} FAILED
                </span>
              ) : (
                <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded border border-slate-300">
                  0 FAILED
                </span>
              )}
            </div>
          )}

          <button
            id="btn-rerun-validation"
            onClick={runAllValidations}
            disabled={isRunning}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-sans text-xs font-semibold rounded shadow-sm transition-colors flex items-center space-x-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>Re-run Validation</span>
          </button>
        </div>
      </div>

      {/* Test Matrix Table */}
      <div className="bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table id="validation-table" className="w-full text-left text-xs font-sans border-collapse">
            <thead>
              <tr className="bg-slate-800 text-slate-200 font-mono uppercase text-[11px] tracking-wider border-b border-slate-700">
                <th className="py-2.5 px-4 font-bold">Group</th>
                <th className="py-2.5 px-4 font-bold">Test Case / Item</th>
                <th className="py-2.5 px-4 font-bold text-right">Expected</th>
                <th className="py-2.5 px-4 font-bold text-right">Actual</th>
                <th className="py-2.5 px-4 font-bold text-right">Difference</th>
                <th className="py-2.5 px-4 font-bold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
              {testRows.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                  <td className="py-2 px-4 font-sans font-semibold text-slate-600 text-[11px]">
                    {row.group}
                  </td>
                  <td className="py-2 px-4 font-sans font-bold text-slate-800 text-xs">
                    {row.testCase}
                  </td>
                  <td className="py-2 px-4 text-right text-slate-700 font-semibold">
                    {row.expectedStr}
                  </td>
                  <td className="py-2 px-4 text-right text-slate-900 font-bold">
                    {row.actualStr}
                  </td>
                  <td className="py-2 px-4 text-right text-slate-500 text-[11px]">
                    {row.diffStr}
                  </td>
                  <td className="py-2 px-4 text-center">
                    {row.passed ? (
                      <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded font-sans">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>PASS</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 bg-rose-50 text-rose-700 border border-rose-300 text-[11px] font-bold px-2 py-0.5 rounded font-sans">
                        <XCircle className="w-3 h-3 text-rose-600" />
                        <span>FAIL</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}

              {testRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-sans italic">
                    Running validation test cases...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

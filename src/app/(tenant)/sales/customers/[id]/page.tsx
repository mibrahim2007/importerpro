import { auth } from '@/lib/auth/config';
import { getTenantDb } from '@/db';
import { customers, customerAddresses, customerContacts, customerPricelists, products } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Edit, Phone, Mail, MapPin } from 'lucide-react';
import { CustomerForm } from '@/components/customers/customer-form';
import { ContactsPanel } from '@/components/customers/contacts-panel';
import { AddressesPanel } from '@/components/customers/addresses-panel';
import { PricelistPanel } from '@/components/customers/pricelist-panel';

export const revalidate = 0;

const TYPE_BADGE: Record<string, string> = {
  manufacturer: 'bg-blue-100 text-blue-700', trader: 'bg-purple-100 text-purple-700',
  distributor: 'bg-cyan-100 text-cyan-700', retailer: 'bg-amber-100 text-amber-700',
  government: 'bg-slate-100 text-slate-600',
};
const FBR_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700', non_filer: 'bg-red-100 text-red-600', exempt: 'bg-slate-100 text-slate-500',
};

export default async function CustomerDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user.tenantSlug) redirect('/login');

  const { id } = await params;
  const { tab = 'overview' } = await searchParams;
  const tdb = await getTenantDb(session.user.tenantSlug);

  const [[customer], addresses, contacts, priceRows, allProducts] = await Promise.all([
    tdb.select().from(customers).where(eq(customers.id, id)).limit(1),
    tdb.select().from(customerAddresses).where(eq(customerAddresses.customerId, id)),
    tdb.select().from(customerContacts).where(eq(customerContacts.customerId, id)),
    tdb.select({
      id: customerPricelists.id,
      productId: customerPricelists.productId,
      productName: products.name,
      productCode: products.code,
      priceTier: customerPricelists.priceTier,
      pricingBasis: customerPricelists.pricingBasis,
      unitPricePkr: customerPricelists.unitPricePkr,
      markupPct: customerPricelists.markupPct,
      effectiveFrom: customerPricelists.effectiveFrom,
      effectiveTo: customerPricelists.effectiveTo,
      isActive: customerPricelists.isActive,
    }).from(customerPricelists)
      .leftJoin(products, eq(products.id, customerPricelists.productId))
      .where(eq(customerPricelists.customerId, id)),
    tdb.select({ id: products.id, name: products.name, code: products.code }).from(products).where(eq(products.isActive, true)),
  ]);

  if (!customer) notFound();

  const creditPkr = parseFloat(customer.creditLimitPkr ?? '0');
  const primaryContact = contacts.find((c) => c.isPrimary) ?? contacts[0];

  const TABS = ['overview', 'contacts', 'addresses', 'pricelist', 'edit'];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/sales/customers"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-900">{customer.name}</h1>
            {customer.code && <span className="font-mono text-xs text-slate-400">{customer.code}</span>}
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_BADGE[customer.customerType ?? ''] ?? 'bg-slate-100 text-slate-500'}`}>
              {(customer.customerType ?? '').charAt(0).toUpperCase() + (customer.customerType ?? '').slice(1)}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${FBR_BADGE[customer.fbrStatus ?? ''] ?? 'bg-slate-100 text-slate-500'}`}>
              {(customer.fbrStatus ?? 'active').replace('_', ' ')}
            </span>
            {!customer.isActive && <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">Inactive</span>}
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-sm text-slate-500">
            {customer.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{customer.phone}</span>}
            {customer.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{customer.email}</span>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <Link key={t} href={`/sales/customers/${id}?tab=${t}`}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t === 'pricelist' ? 'Price List' : t}
          </Link>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-4">
            {/* Tax & Identity */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Tax & FBR Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-3 gap-4 text-sm">
                {[
                  { label: 'NTN', value: customer.ntn ?? '—' },
                  { label: 'STRN', value: customer.strn ?? '—' },
                  { label: 'CNIC', value: customer.cnic ?? '—' },
                  { label: 'Sales Tax Category', value: (customer.salesTaxCategory ?? '').replace('_', ' ') },
                  { label: 'WHT Rate (Sec 153)', value: `${customer.whtRatePct ?? '4.5'}%` },
                  { label: 'FBR Status', value: (customer.fbrStatus ?? 'active').replace('_', ' ') },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="font-medium text-slate-800 mt-0.5">{value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Credit & Payment */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Credit & Payment Terms</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-3 gap-4 text-sm">
                {[
                  { label: 'Payment Terms', value: (customer.paymentTerms ?? '').replace('_', ' ').replace('net', 'Net') },
                  { label: 'Credit Limit', value: creditPkr > 0 ? `PKR ${creditPkr.toLocaleString('en-PK', { maximumFractionDigits: 0 })}` : 'No limit' },
                  { label: 'Payment Mode', value: (customer.preferredPaymentMode ?? '').toUpperCase() },
                  { label: 'Bank', value: customer.bankName ?? '—' },
                  { label: 'Opening Balance', value: `PKR ${parseFloat(customer.openingBalance ?? '0').toLocaleString('en-PK', { maximumFractionDigits: 0 })}` },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="font-medium text-slate-800 mt-0.5">{value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Primary contact */}
            {primaryContact && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Primary Contact</CardTitle></CardHeader>
                <CardContent className="flex items-start gap-4 text-sm">
                  <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold shrink-0">
                    {primaryContact.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{primaryContact.name}</p>
                    {primaryContact.designation && <p className="text-slate-500 text-xs">{primaryContact.designation}</p>}
                    <div className="flex gap-3 mt-1 text-xs text-slate-500">
                      {primaryContact.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{primaryContact.phone}</span>}
                      {primaryContact.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{primaryContact.email}</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {customer.notes && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-slate-600">{customer.notes}</p></CardContent>
              </Card>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            <Card className="bg-slate-800 border-0">
              <CardContent className="p-4 space-y-3">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Account Summary</p>
                {[
                  { label: 'Opening Balance', value: `PKR ${parseFloat(customer.openingBalance ?? '0').toLocaleString('en-PK', { maximumFractionDigits: 0 })}` },
                  { label: 'Credit Limit', value: creditPkr > 0 ? `PKR ${creditPkr.toLocaleString('en-PK', { maximumFractionDigits: 0 })}` : '—' },
                  { label: 'Contacts', value: String(contacts.length) },
                  { label: 'Ship-to Addresses', value: String(addresses.length) },
                  { label: 'Pricelist Items', value: String(priceRows.length) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-slate-400">{label}</span>
                    <span className="text-white font-medium">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {addresses.filter((a) => a.isDefault)[0] && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Default Ship-to</CardTitle></CardHeader>
                <CardContent className="text-sm text-slate-600">
                  {addresses.filter((a) => a.isDefault)[0]?.label && (
                    <p className="font-medium text-slate-700">{addresses.filter((a) => a.isDefault)[0]!.label}</p>
                  )}
                  <p>{addresses.filter((a) => a.isDefault)[0]?.address}</p>
                  {addresses.filter((a) => a.isDefault)[0]?.city && <p className="text-slate-400">{addresses.filter((a) => a.isDefault)[0]!.city}</p>}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === 'contacts' && <ContactsPanel customerId={id} contacts={contacts} />}
      {tab === 'addresses' && <AddressesPanel customerId={id} addresses={addresses} />}
      {tab === 'pricelist' && <PricelistPanel customerId={id} pricelists={priceRows} products={allProducts} />}
      {tab === 'edit' && (
        <CustomerForm
          customerId={id}
          initial={{
            name: customer.name, customerType: customer.customerType, ntn: customer.ntn,
            strn: customer.strn, cnic: customer.cnic, fbrStatus: customer.fbrStatus,
            billingAddress: customer.billingAddress, phone: customer.phone, email: customer.email,
            paymentTerms: customer.paymentTerms, creditLimitPkr: customer.creditLimitPkr,
            salesTaxCategory: customer.salesTaxCategory, whtRatePct: customer.whtRatePct,
            preferredPaymentMode: customer.preferredPaymentMode, bankName: customer.bankName,
            openingBalance: customer.openingBalance, notes: customer.notes,
          }}
        />
      )}
    </div>
  );
}

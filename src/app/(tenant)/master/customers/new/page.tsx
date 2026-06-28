import { CustomerForm } from '@/components/master/customer-form';

export default function NewCustomerPage() {
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New Customer</h1>
        <p className="text-sm text-slate-500 mt-0.5">Add a buyer, distributor, or institutional customer</p>
      </div>
      <CustomerForm />
    </div>
  );
}

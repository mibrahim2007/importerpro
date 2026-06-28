import { SupplierForm } from '@/components/master/supplier-form';

export default function NewSupplierPage() {
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New Supplier</h1>
        <p className="text-sm text-slate-500 mt-0.5">Add a foreign or local supplier / clearing agent / freight forwarder</p>
      </div>
      <SupplierForm />
    </div>
  );
}

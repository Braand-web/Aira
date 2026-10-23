import {redirect} from 'next/navigation';

type PricingPageProps = {
  searchParams: Promise<{billingOrder?: string | string[]}>;
};

export default async function Pricing({searchParams}: PricingPageProps) {
  const {billingOrder} = await searchParams;
  const query = new URLSearchParams({settings: 'billing'});
  if (typeof billingOrder === 'string' && billingOrder) {
    query.set('billingOrder', billingOrder);
  }
  redirect('/?' + query.toString());
}

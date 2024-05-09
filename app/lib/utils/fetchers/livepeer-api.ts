import { LivepeerCacheAsset } from '@app/lib/types';
import { z } from 'zod';
import { LIVEPEER_API_URL } from '../context';

type LivepeerFetcherArgs = {
  apiKey: string;
};

type HttpMethod = 'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE';

type FetcherOptions = {
  path: string;
  method?: HttpMethod;
  cache?: RequestCache | undefined;
  body?: BodyInit | undefined;
};
export type JSONResponse = {
  data: LivepeerCacheAsset | LivepeerCacheAsset[];
  error?: { message: string };
};

export class LivepeerFetcher {
  private apiKey: string;

  constructor({ apiKey }: LivepeerFetcherArgs) {
    this.apiKey = apiKey;
  }

  private async fetcher({ cache = 'no-store', path, method }: FetcherOptions) {
    try {
      const res = await fetch(`${LIVEPEER_API_URL}/${path}`, {
        cache,
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!res.ok) {
        throw new Error(res.statusText);
      }

      return await res.json();
    } catch (err: any) {
      throw err;
    }
  }

  async getAll(): Promise<LivepeerCacheAsset[] | string> {
    try {
      const res = await fetch(`${LIVEPEER_API_URL}/asset`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        cache: 'no-store',
        method: 'GET',
      });

      if (!res.ok) {
        throw new Error(res.statusText);
      }

      return await res.json();
    } catch (err: any) {
      console.error('getAll::Error: ', err);
      throw new Error('Failed to fetch Assets...');
    }
  }

  async getById(id: string): Promise<LivepeerCacheAsset> {
    try {
      const res = await fetch(`${LIVEPEER_API_URL}/asset/${id}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        cache: 'no-store',
        method: 'GET',
      });

      if (!res.ok) {
        throw new Error(res.statusText);
      }

      const data = await res.json();
      return data;
    } catch (err: any) {
      console.error('getById::Error: ', err);
      throw new Error('Failed to fetch Asset..');
    }
  }

  async deleteById(id: string): Promise<{ msg: string; status: boolean }> {
    try {
      // const data = await this.fetcher({ path: `/asset/${id}` });
      const res = await fetch(`${LIVEPEER_API_URL}/asset/${id}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        cache: 'no-store',
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error(res.statusText);
      }

      return { msg: res.statusText, status: res.ok };
    } catch (err: any) {
      console.log('err: ', err);
      throw new Error('Failed to fetch Asset..');
    }
  }

  FormSchema = z.object({
    id: z.string(),
    customer_id: z.string({
      invalid_type_error: 'Please select a customer',
    }),
    amount: z.coerce
      .number()
      .gt(0, { message: 'Please enter an amount greater than $0' }),
    status: z.enum(['pending', 'paid'], {
      invalid_type_error: 'Please select an invoice status',
    }),
    date: z.string(),
  });

  // CreateInvoice = FormSchema.omit({ id: true, date: true });

  // export async function createInvoice(prevState: State, formData: FormData) {
  //   //
  //   const validatedFields = CreateInvoice.safeParse({
  //     customer_id: formData.get('customer_id'),
  //     amount: formData.get('amount'),
  //     status: formData.get('status'),
  //   });

  //   console.log('validatedFields: ', validatedFields);
  //   // If form validation fails, return errors early. Otherwise, continue.
  //   if (!validatedFields.success) {
  //     return {
  //       error: validatedFields.error.flatten().fieldErrors,
  //       message: 'Missing Fields. Failed to Create Invoice.',
  //     };
  //   }

  //   // Prep data for insertion into db
  //   const { amount, customer_id, status } = validatedFields.data;
  //   const amountInCents = amount * 100;
  //   const date = new Date().toISOString().split('T')[0];

  //   try {
  //     await sql`
  //         INSERT INTO invoices (customer_id, amount, status, date)
  //         VALUES (${customer_id}, ${amountInCents}, ${status}, ${date})`;
  //   } catch (err: any) {
  //     console.error(err);
  //     // If a database error occurs, return a more specific error.
  //     return {
  //       message: 'Database Error: Failed to Create Invoice.',
  //     };
  //   }

  //   // Revalidate the cache for the invoices page and redirect
  //   revalidatePath('/dashboard/invoices');
  //   redirect('/dashboard/invoices');
}

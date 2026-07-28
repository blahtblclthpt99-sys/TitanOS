import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const fetchData = async (endpoint: string) => {
    const { data, error } = await supabase
        .from(endpoint)
        .select('*');

    if (error) {
        throw new Error(`Error fetching data: ${error.message}`);
    }

    return data;
};

export const postData = async (endpoint: string, payload: any) => {
    const { data, error } = await supabase
        .from(endpoint)
        .insert([payload]);

    if (error) {
        throw new Error(`Error posting data: ${error.message}`);
    }

    return data;
};

export const updateData = async (endpoint: string, id: string, payload: any) => {
    const { data, error } = await supabase
        .from(endpoint)
        .update(payload)
        .match({ id });

    if (error) {
        throw new Error(`Error updating data: ${error.message}`);
    }

    return data;
};

export const deleteData = async (endpoint: string, id: string) => {
    const { data, error } = await supabase
        .from(endpoint)
        .delete()
        .match({ id });

    if (error) {
        throw new Error(`Error deleting data: ${error.message}`);
    }

    return data;
};
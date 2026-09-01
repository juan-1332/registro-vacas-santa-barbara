# Registro de Vacas

Pequeña aplicación web para registrar vacas, asignar raza y clasificar por peso.

Cómo usar:

1. Abrir `index.html` en un navegador moderno.
2. La aplicación usa únicamente la raza Brahman y muestra sus rangos oficiales por sexo y competencia mensual.
3. En "Registrar Vaca" ingresa código, fecha de nacimiento, peso y sexo. La edad y los rangos se manejan en meses.
4. La tabla "Bovinos registrados" muestra la clasificación: "Bajo peso", "Peso promedio" o "Sobrepeso".
5. Usa "Buscar por código" para localizar rápidamente un bovino.
6. Puedes editar el peso de un bovino desde la tabla.

Los datos se guardan en `localStorage` del navegador.

# Gestión ganadera Santa Bárbara

La aplicación permite iniciar sesión como `admin` o `usuario`.

- `usuario`: consulta todos los datos, crea animales y razas, y solo modifica o elimina los animales y razas que creó.
- `admin`: además puede modificar rangos y administrar cualquier animal o raza.

## Activar la base de datos en la nube

1. Crea un proyecto en [Supabase](https://supabase.com).
2. En el SQL Editor ejecuta todo el bloque siguiente.
3. Copia la URL del proyecto y la clave `anon` en las constantes `SUPABASE_URL` y `SUPABASE_ANON_KEY` de `app.js`.
4. En Authentication > Providers > Email habilita Email.
5. Publica la carpeta en cualquier hosting estático. Abrir `index.html` directamente también permite probarla, aunque Supabase recomienda servirla por HTTPS.

```sql
create table public.profiles (
	id uuid primary key references auth.users(id) on delete cascade,
	role text not null default 'usuario' check (role in ('admin', 'usuario'))
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
	insert into public.profiles (id) values (new.id);
	return new;
end;
$$;

create trigger on_auth_user_created
	after insert on auth.users
	for each row execute procedure public.handle_new_user();

create table public.breeds (
	id uuid primary key default gen_random_uuid(),
	name text not null unique,
	ranges jsonb not null default '{"Macho": [], "Hembra": []}'::jsonb,
	created_by uuid not null references auth.users(id),
	created_at timestamptz not null default now()
);

create table public.animals (
	id uuid primary key default gen_random_uuid(),
	codigo text not null,
	fecha_nacimiento date not null,
	peso numeric not null check (peso > 0),
	raza text not null references public.breeds(name),
	sexo text not null check (sexo in ('Macho', 'Hembra')),
	created_by uuid not null references auth.users(id),
	created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.breeds enable row level security;
alter table public.animals enable row level security;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as $$
	select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create policy "profiles own read" on public.profiles for select using (id = auth.uid());
create policy "breeds shared read" on public.breeds for select using (auth.uid() is not null);
create policy "breeds own or admin insert" on public.breeds for insert with check (created_by = auth.uid());
create policy "breeds admin update" on public.breeds for update using (public.is_admin());
create policy "breeds own or admin delete" on public.breeds for delete using (created_by = auth.uid() or public.is_admin());
create policy "animals shared read" on public.animals for select using (auth.uid() is not null);
create policy "animals own insert" on public.animals for insert with check (created_by = auth.uid());
create policy "animals admin update" on public.animals for update using (public.is_admin());
create policy "animals own or admin delete" on public.animals for delete using (created_by = auth.uid() or public.is_admin());
```

Después de crear la primera cuenta, conviértela en administradora desde SQL:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'correo-del-admin@example.com');
```

Mientras las constantes de Supabase conserven `TU-PROYECTO` y `TU-ANON-KEY`, la interfaz funciona en modo local para pruebas. El primer usuario local queda como administrador y los siguientes como usuarios.

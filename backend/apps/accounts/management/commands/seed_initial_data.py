from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.accounts.models import Department, UserRole
from apps.categories.models import Category, SubCategory, SlaPolicy, PriorityLevel

User = get_user_model()


class Command(BaseCommand):
    help = 'Seeds initial departments, SLA policies, categories, and test users.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Seeding initial data..."))

        # 1. Departments
        departments_data = [
            ("IT Support", "IT"),
            ("Engineering", "ENG"),
            ("Human Resources", "HR"),
            ("Finance", "FIN"),
            ("Operations", "OPS"),
        ]
        dept_objs = {}
        for name, code in departments_data:
            dept, _ = Department.objects.get_or_create(code=code, defaults={'name': name})
            dept_objs[code] = dept
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(dept_objs)} departments."))

        # 2. SLA Policies
        sla_data = [
            (PriorityLevel.CRITICAL, "Critical Priority SLA", 15, 120),
            (PriorityLevel.HIGH, "High Priority SLA", 30, 240),
            (PriorityLevel.MEDIUM, "Medium Priority SLA", 120, 480),
            (PriorityLevel.LOW, "Low Priority SLA", 240, 1440),
        ]
        for priority, name, resp_m, res_m in sla_data:
            SlaPolicy.objects.get_or_create(
                priority=priority,
                defaults={
                    'name': name,
                    'response_time_minutes': resp_m,
                    'resolution_time_minutes': res_m,
                }
            )
        self.stdout.write(self.style.SUCCESS("Seeded SLA policies for all 4 priority levels."))

        # 3. Categories and Subcategories
        taxonomies = [
            ("Hardware", [
                ("Laptop / Workstation", PriorityLevel.HIGH),
                ("Monitor / Display", PriorityLevel.MEDIUM),
                ("Peripherals (Mouse/Keyboard/Headset)", PriorityLevel.LOW),
                ("Printer / Scanner", PriorityLevel.MEDIUM),
            ]),
            ("Software", [
                ("Operating System (Windows/Mac/Linux)", PriorityLevel.HIGH),
                ("Email & Calendar (Outlook)", PriorityLevel.HIGH),
                ("Productivity Suite (Office 365)", PriorityLevel.MEDIUM),
                ("Development Tools", PriorityLevel.MEDIUM),
            ]),
            ("Network & Connectivity", [
                ("Wi-Fi Access", PriorityLevel.HIGH),
                ("VPN Connection", PriorityLevel.HIGH),
                ("LAN / Ethernet Port", PriorityLevel.MEDIUM),
                ("Internet Outage", PriorityLevel.CRITICAL),
            ]),
            ("Access & Security", [
                ("Password Reset", PriorityLevel.HIGH),
                ("Folder / Drive Permissions", PriorityLevel.MEDIUM),
                ("Account Locked", PriorityLevel.HIGH),
                ("New Employee Onboarding Equipment", PriorityLevel.MEDIUM),
            ]),
        ]
        for cat_name, subcats in taxonomies:
            cat, _ = Category.objects.get_or_create(name=cat_name)
            for sub_name, default_prio in subcats:
                SubCategory.objects.get_or_create(
                    category=cat,
                    name=sub_name,
                    defaults={'default_priority': default_prio}
                )
        self.stdout.write(self.style.SUCCESS("Seeded categories and subcategories."))

        # 4. Users (Admin, Agent, Employee)
        users_seed = [
            ("admin@itsupport.local", "admin", "AdminPassword123!", "System", "Administrator", UserRole.ADMIN, dept_objs["IT"], True, True),
            ("agent.john@itsupport.local", "agent_john", "AgentPassword123!", "John", "Technician", UserRole.SUPPORT_AGENT, dept_objs["IT"], True, False),
            ("emp.alice@itsupport.local", "emp_alice", "UserPassword123!", "Alice", "Developer", UserRole.EMPLOYEE, dept_objs["ENG"], False, False),
        ]
        for email, username, password, first, last, role, dept, is_staff, is_super in users_seed:
            user = User.objects.filter(username=username).first()
            if not user:
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                    first_name=first,
                    last_name=last,
                    role=role,
                    department=dept,
                    is_staff=is_staff,
                    is_superuser=is_super
                )
                self.stdout.write(self.style.SUCCESS(f"Created user: {username} ({role})"))
            else:
                self.stdout.write(self.style.WARNING(f"User {username} already exists."))

        self.stdout.write(self.style.SUCCESS("Seed data completed successfully!"))

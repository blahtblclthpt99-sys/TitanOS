import unittest

from orchestrator import Orchestrator


class OrchestratorTests(unittest.TestCase):
    def test_orchestrator_lists_projects_and_builds_plan(self):
        orchestrator = Orchestrator('.')
        projects = orchestrator.list_projects()
        self.assertIn('Project Registry', projects)
        self.assertIn('TitanOS', projects)
        plan = orchestrator.build_plan('TitanOS')
        self.assertIn('Execution Plan', plan)


if __name__ == '__main__':
    unittest.main()

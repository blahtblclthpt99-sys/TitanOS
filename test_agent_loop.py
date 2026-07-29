import unittest

from agent_loop import AgentLoop


class AgentLoopTests(unittest.TestCase):
    def test_agent_loop_handles_task_and_scan(self):
        loop = AgentLoop('.')
        task_result = loop.run('task inspect startup')
        self.assertIn('Active task set', task_result)
        current_result = loop.run('current')
        self.assertIn('Active task', current_result)
        scan_result = loop.run('scan')
        self.assertIn('files found', scan_result)


if __name__ == '__main__':
    unittest.main()
